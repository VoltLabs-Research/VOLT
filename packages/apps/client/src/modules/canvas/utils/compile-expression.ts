import { BUILTINS, ExpressionError, parse } from '@voltstack/expressions';
import type { AtomContext, ColumnView, Expr } from '@voltstack/expressions';

// Compiles an expression once and evaluates it a block of atoms at a time: each node runs one
// tight loop over typed arrays instead of the tree being walked again for every atom. It keeps
// the semantics of the package's per-atom `evaluate`, with one difference: errors that depend
// only on the formula and the columns (unknown names, strings in arithmetic, arity) are reported
// at compile time, even inside a branch that && or || would skip.
const BLOCK_SIZE = 4096;

const COMPONENT_INDEX: Readonly<Record<string, number>> = {
    X: 0,
    Y: 1,
    Z: 2
};

interface NumericNode {
    kind: 'num';
    // Values for the atoms [start, start + length). `active` marks the lanes whose value is
    // used, null meaning all of them; division by zero is an error only on an active lane, as
    // it is when && and || skip their right operand.
    run(start: number, length: number, active: Uint8Array | null): Float64Array;
    // Set on literals and on single-component columns, so `column <op> literal` can read the
    // column in the same pass that compares it.
    constant?: number;
    column?: ArrayLike<number>;
}

// Strings only come from literals and string columns, so nothing under them can fail.
interface StringNode {
    kind: 'str';
    at(atomIndex: number): string;
}

type CompiledNode = NumericNode | StringNode;

export interface ExpressionSelection {
    mask: Uint8Array;
    count: number;
}

export interface CompiledExpression {
    // 1 for every atom whose value is non-zero, as an expression selection reads it.
    select(): ExpressionSelection;
}

const constantNode = (value: number): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE).fill(value);
    return {
        kind: 'num',
        constant: value,
        run: () => out
    };
};

const constantString = (value: string): StringNode => ({
    kind: 'str',
    at: () => value
});

const particleIndexNode = (): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    return {
        kind: 'num',
        run(start, length) {
            for (let lane = 0; lane < length; lane += 1) out[lane] = start + lane;
            return out;
        }
    };
};

const numericColumnNode = (values: ArrayLike<number>, stride: number, component: number): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    return {
        kind: 'num',
        column: stride === 1 ? values : undefined,
        run(start, length) {
            if (stride === 1) {
                for (let lane = 0; lane < length; lane += 1) out[lane] = values[start + lane];
                return out;
            }
            let offset = start * stride + component;
            for (let lane = 0; lane < length; lane += 1, offset += stride) out[lane] = values[offset];
            return out;
        }
    };
};

const stringColumnNode = (values: readonly string[], stride: number, component: number): StringNode => ({
    kind: 'str',
    at: (atomIndex) => values[atomIndex * stride + component]
});

const columnNode = (column: ColumnView, component: number): CompiledNode => {
    const stride = column.componentCount ?? 1;
    if (column.dtype === 'str') {
        return stringColumnNode(column.values as string[], stride, component);
    }
    return numericColumnNode(column.values as ArrayLike<number>, stride, component);
};

const requireNumeric = (node: CompiledNode, what: string): NumericNode => {
    if (node.kind === 'str') {
        throw new ExpressionError(`cannot use string column/value '${what}' in arithmetic`);
    }
    return node;
};

const negateNode = (operand: NumericNode): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    return {
        kind: 'num',
        run(start, length, active) {
            const values = operand.run(start, length, active);
            for (let lane = 0; lane < length; lane += 1) out[lane] = -values[lane];
            return out;
        }
    };
};

const notNode = (operand: NumericNode): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    return {
        kind: 'num',
        run(start, length, active) {
            const values = operand.run(start, length, active);
            for (let lane = 0; lane < length; lane += 1) out[lane] = values[lane] === 0 ? 1 : 0;
            return out;
        }
    };
};

// && and || evaluate their right operand only on the lanes the left one leaves undecided:
// non-zero for &&, zero for ||. The loops are split by operator to stay branch-free.
const andNode = (left: NumericNode, right: NumericNode): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    const rightActive = new Uint8Array(BLOCK_SIZE);
    return {
        kind: 'num',
        run(start, length, active) {
            const lhs = left.run(start, length, active);
            let undecided = 0;
            if (active === null) {
                for (let lane = 0; lane < length; lane += 1) {
                    const open = lhs[lane] !== 0 ? 1 : 0;
                    rightActive[lane] = open;
                    undecided += open;
                }
            } else {
                for (let lane = 0; lane < length; lane += 1) {
                    const open = active[lane] & (lhs[lane] !== 0 ? 1 : 0);
                    rightActive[lane] = open;
                    undecided += open;
                }
            }
            if (undecided === 0) {
                out.fill(0, 0, length);
                return out;
            }
            const rhs = right.run(start, length, rightActive);
            for (let lane = 0; lane < length; lane += 1) {
                out[lane] = lhs[lane] !== 0 && rhs[lane] !== 0 ? 1 : 0;
            }
            return out;
        }
    };
};

const orNode = (left: NumericNode, right: NumericNode): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    const rightActive = new Uint8Array(BLOCK_SIZE);
    return {
        kind: 'num',
        run(start, length, active) {
            const lhs = left.run(start, length, active);
            let undecided = 0;
            if (active === null) {
                for (let lane = 0; lane < length; lane += 1) {
                    const open = lhs[lane] === 0 ? 1 : 0;
                    rightActive[lane] = open;
                    undecided += open;
                }
            } else {
                for (let lane = 0; lane < length; lane += 1) {
                    const open = active[lane] & (lhs[lane] === 0 ? 1 : 0);
                    rightActive[lane] = open;
                    undecided += open;
                }
            }
            if (undecided === 0) {
                out.fill(1, 0, length);
                return out;
            }
            const rhs = right.run(start, length, rightActive);
            for (let lane = 0; lane < length; lane += 1) {
                out[lane] = lhs[lane] !== 0 || rhs[lane] !== 0 ? 1 : 0;
            }
            return out;
        }
    };
};

type ArithmeticOp = '+' | '-' | '*' | '/' | '^' | '<' | '>' | '<=' | '>=' | '==' | '!=';

type ComparisonOp = '<' | '>' | '<=' | '>=' | '==' | '!=';

const MIRRORED: Readonly<Record<ComparisonOp, ComparisonOp>> = {
    '<': '>',
    '>': '<',
    '<=': '>=',
    '>=': '<=',
    '==': '==',
    '!=': '!='
};

const isComparison = (op: ArithmeticOp): op is ComparisonOp => op in MIRRORED;

// `column <op> literal`, the usual shape of a selection, compared straight from the column.
const columnComparisonNode = (op: ComparisonOp, values: ArrayLike<number>, constant: number): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    return {
        kind: 'num',
        run(start, length) {
            switch (op) {
                case '<': for (let lane = 0; lane < length; lane += 1) out[lane] = values[start + lane] < constant ? 1 : 0; break;
                case '>': for (let lane = 0; lane < length; lane += 1) out[lane] = values[start + lane] > constant ? 1 : 0; break;
                case '<=': for (let lane = 0; lane < length; lane += 1) out[lane] = values[start + lane] <= constant ? 1 : 0; break;
                case '>=': for (let lane = 0; lane < length; lane += 1) out[lane] = values[start + lane] >= constant ? 1 : 0; break;
                case '==': for (let lane = 0; lane < length; lane += 1) out[lane] = values[start + lane] === constant ? 1 : 0; break;
                case '!=': for (let lane = 0; lane < length; lane += 1) out[lane] = values[start + lane] !== constant ? 1 : 0; break;
            }
            return out;
        }
    };
};

const arithmeticNode = (op: ArithmeticOp, left: NumericNode, right: NumericNode): NumericNode => {
    if (isComparison(op)) {
        if (left.column && right.constant !== undefined) {
            return columnComparisonNode(op, left.column, right.constant);
        }
        if (right.column && left.constant !== undefined) {
            return columnComparisonNode(MIRRORED[op], right.column, left.constant);
        }
    }
    const out = new Float64Array(BLOCK_SIZE);
    return {
        kind: 'num',
        run(start, length, active) {
            const a = left.run(start, length, active);
            const b = right.run(start, length, active);
            switch (op) {
                case '+': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] + b[lane]; break;
                case '-': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] - b[lane]; break;
                case '*': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] * b[lane]; break;
                case '/':
                    for (let lane = 0; lane < length; lane += 1) {
                        if (b[lane] === 0 && (active === null || active[lane] === 1)) {
                            throw new ExpressionError('division by zero');
                        }
                        out[lane] = a[lane] / b[lane];
                    }
                    break;
                case '^': for (let lane = 0; lane < length; lane += 1) out[lane] = Math.pow(a[lane], b[lane]); break;
                case '<': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] < b[lane] ? 1 : 0; break;
                case '>': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] > b[lane] ? 1 : 0; break;
                case '<=': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] <= b[lane] ? 1 : 0; break;
                case '>=': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] >= b[lane] ? 1 : 0; break;
                case '==': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] === b[lane] ? 1 : 0; break;
                case '!=': for (let lane = 0; lane < length; lane += 1) out[lane] = a[lane] !== b[lane] ? 1 : 0; break;
            }
            return out;
        }
    };
};

// == and != between strings, or between a string and a number, which are never equal.
const mixedEqualityNode = (op: '==' | '!=', left: CompiledNode, right: CompiledNode): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    const equal = op === '==' ? 1 : 0;
    const unequal = 1 - equal;
    return {
        kind: 'num',
        run(start, length, active) {
            // The numeric side still runs, for the division by zero it may raise.
            if (left.kind === 'num') left.run(start, length, active);
            if (right.kind === 'num') right.run(start, length, active);
            if (left.kind !== 'str' || right.kind !== 'str') {
                out.fill(unequal, 0, length);
                return out;
            }
            for (let lane = 0; lane < length; lane += 1) {
                out[lane] = left.at(start + lane) === right.at(start + lane) ? equal : unequal;
            }
            return out;
        }
    };
};

const callNode = (builtin: (args: number[]) => number, args: NumericNode[]): NumericNode => {
    const out = new Float64Array(BLOCK_SIZE);
    const argv = new Array<number>(args.length).fill(0);
    const blocks = new Array<Float64Array>(args.length);
    return {
        kind: 'num',
        run(start, length, active) {
            for (let index = 0; index < args.length; index += 1) {
                blocks[index] = args[index].run(start, length, active);
            }
            for (let lane = 0; lane < length; lane += 1) {
                for (let index = 0; index < args.length; index += 1) argv[index] = blocks[index][lane];
                out[lane] = builtin(argv);
            }
            return out;
        }
    };
};

const compileVariable = (name: string, context: AtomContext): CompiledNode => {
    switch (name) {
        case 'ParticleIndex':
            return particleIndexNode();
        case 'N':
            return constantNode(context.N);
        case 'Frame':
            return constantNode(context.Frame);
        case 'CellVolume':
            return constantNode(context.CellVolume);
    }
    const column = context.getColumn(name);
    if (!column) {
        throw new ExpressionError(`unknown variable or column '${name}'`);
    }
    const components = column.componentCount ?? 1;
    if (components !== 1) {
        throw new ExpressionError(`'${name}' has ${components} components; use ${name}.X / ${name}.Y / ${name}.Z`);
    }
    return columnNode(column, 0);
};

const compileMember = (object: string, property: string, context: AtomContext): CompiledNode => {
    const component = Object.hasOwn(COMPONENT_INDEX, property) ? COMPONENT_INDEX[property] : undefined;
    if (component === undefined) {
        throw new ExpressionError(`unknown component '${object}.${property}' (expected X, Y or Z)`);
    }
    // A frame may carry the component as a column of its own, as dumps store x, y and z.
    const flat = context.getColumn(`${object}.${property}`);
    if (flat && (flat.componentCount ?? 1) === 1) {
        return columnNode(flat, 0);
    }
    const column = context.getColumn(object);
    if (!column) {
        throw new ExpressionError(`unknown column '${object}'`);
    }
    const components = column.componentCount ?? 1;
    if (component >= components) {
        throw new ExpressionError(`'${object}' has ${components} component(s); '.${property}' is out of range`);
    }
    return columnNode(column, component);
};

const compileNode = (expr: Expr, context: AtomContext): CompiledNode => {
    switch (expr.type) {
        case 'literal':
            if (typeof expr.value === 'string') return constantString(expr.value);
            return constantNode(typeof expr.value === 'boolean' ? (expr.value ? 1 : 0) : expr.value);
        case 'variable':
            return compileVariable(expr.name, context);
        case 'member':
            return compileMember(expr.object, expr.property, context);
        case 'unary': {
            const operand = requireNumeric(compileNode(expr.operand, context), 'operand');
            return expr.op === '-' ? negateNode(operand) : notNode(operand);
        }
        case 'binary': {
            const { op } = expr;
            if (op === '&&' || op === '||') {
                const left = requireNumeric(compileNode(expr.left, context), op);
                const right = requireNumeric(compileNode(expr.right, context), op);
                return op === '&&' ? andNode(left, right) : orNode(left, right);
            }
            const left = compileNode(expr.left, context);
            const right = compileNode(expr.right, context);
            if ((op === '==' || op === '!=') && (left.kind === 'str' || right.kind === 'str')) {
                return mixedEqualityNode(op, left, right);
            }
            return arithmeticNode(
                op,
                requireNumeric(left, 'left operand'),
                requireNumeric(right, 'right operand')
            );
        }
        case 'call': {
            if (!Object.hasOwn(BUILTINS, expr.func)) {
                throw new ExpressionError(`unknown function '${expr.func}'`);
            }
            const builtin = BUILTINS[expr.func];
            const args = expr.args.map((arg) => requireNumeric(compileNode(arg, context), expr.func));
            // Builtins only throw on their argument count, which is fixed by the formula.
            builtin(new Array<number>(args.length).fill(0));
            return callNode(builtin, args);
        }
    }
};

export const compileExpression = (formula: string, context: AtomContext): CompiledExpression => {
    const root = compileNode(parse(formula), context);
    if (root.kind === 'str') {
        throw new ExpressionError('expression resolved to a string; expected a numeric or boolean result');
    }

    return {
        select() {
            const count = context.N;
            const mask = new Uint8Array(count);
            let matched = 0;
            for (let start = 0; start < count; start += BLOCK_SIZE) {
                const length = Math.min(BLOCK_SIZE, count - start);
                const values = root.run(start, length, null);
                for (let lane = 0; lane < length; lane += 1) {
                    const selected = values[lane] !== 0 ? 1 : 0;
                    mask[start + lane] = selected;
                    matched += selected;
                }
            }
            return {
                mask,
                count: matched
            };
        }
    };
};
