import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

export type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

interface ParticleMaskEvaluation {
    mask: Uint8Array;
    matchCount: number;
}

type ScalarComparator = (value: number, reference: number) => boolean;

const HIGHLIGHT_COLOR: readonly [number, number, number] = [1.0, 0.2, 0.6];
const DEFAULT_COLOR: readonly [number, number, number] = [0.8, 0.8, 0.8];

const CATEGORICAL_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
    [0.121, 0.466, 0.705],
    [1.0, 0.498, 0.054],
    [0.172, 0.627, 0.172],
    [0.839, 0.152, 0.156],
    [0.580, 0.404, 0.741],
    [0.549, 0.337, 0.294],
    [0.890, 0.466, 0.760],
    [0.498, 0.498, 0.498],
    [0.737, 0.741, 0.133],
    [0.090, 0.745, 0.811]
];

const selectCmp = (operator: ComparisonOperator): ScalarComparator => {
    switch (operator) {
        case '==': return (value, reference) => value === reference;
        case '!=': return (value, reference) => value !== reference;
        case '>':  return (value, reference) => value > reference;
        case '>=': return (value, reference) => value >= reference;
        case '<':  return (value, reference) => value < reference;
        case '<=': return (value, reference) => value <= reference;
        default: {
            const unreachable: never = operator;
            throw new Error(`FilterEvaluator: unsupported comparison operator '${unreachable}'`);
        }
    }
};

const countActive = (mask: Uint8Array): number => {
    const length = mask.length;
    let count = 0;
    for (let index = 0; index < length; index++) {
        count += mask[index];
    }
    return count;
};

export const evaluateComparison = (
    values: Float32Array,
    operator: ComparisonOperator,
    reference: number
): ParticleMaskEvaluation => {
    const length = values.length;
    const mask = new Uint8Array(length);
    const cmp = selectCmp(operator);
    let matchCount = 0;

    for (let index = 0; index < length; index++) {
        if (cmp(values[index], reference)) {
            mask[index] = 1;
            matchCount++;
        }
    }

    return {
        mask,
        matchCount
    };
};

export const evaluateStringComparison = (
    values: Array<string | null>,
    operator: ComparisonOperator,
    reference: string
): ParticleMaskEvaluation => {
    if (operator !== '==' && operator !== '!=') {
        throw ApplicationError.badRequest(
            ErrorCodes.FILTER_STRING_OPERATOR_UNSUPPORTED,
            'String particle filters support only == and != operators.'
        );
    }

    const length = values.length;
    const mask = new Uint8Array(length);
    let matchCount = 0;

    for (let index = 0; index < length; index++) {
        const current = values[index];
        const matches = operator === '=='
            ? current === reference
            : current !== null && current !== reference;
        if (matches) {
            mask[index] = 1;
            matchCount++;
        }
    }

    return {
        mask,
        matchCount
    };
};

export const invertMask = (mask: Uint8Array): Uint8Array => {
    const length = mask.length;
    const inverted = new Uint8Array(length);
    for (let index = 0; index < length; index++) {
        inverted[index] = mask[index] ^ 1;
    }
    return inverted;
};

export const selectAtomsByMask = (
    positions: Float32Array,
    types: Uint16Array,
    mask: Uint8Array
): { positions: Float32Array; types: Uint16Array; count: number } => {
    const count = countActive(mask);
    const selectedPositions = new Float32Array(count * 3);
    const selectedTypes = new Uint16Array(count);
    let cursor = 0;

    for (let index = 0; index < mask.length; index++) {
        if (!mask[index]) continue;

        const sourceOffset = index * 3;
        const targetOffset = cursor * 3;
        selectedPositions[targetOffset] = positions[sourceOffset];
        selectedPositions[targetOffset + 1] = positions[sourceOffset + 1];
        selectedPositions[targetOffset + 2] = positions[sourceOffset + 2];
        selectedTypes[cursor] = types[index];
        cursor++;
    }

    return {
        positions: selectedPositions,
        types: selectedTypes,
        count
    };
};

export const buildHighlightColors = (
    mask: Uint8Array,
    atomCount: number
): { colors: Float32Array; highlightedCount: number } => {
    const colors = new Float32Array(atomCount * 3);
    let highlightedCount = 0;

    for (let index = 0; index < atomCount; index++) {
        const color = mask[index] === 1 ? HIGHLIGHT_COLOR : DEFAULT_COLOR;
        const offset = index * 3;
        colors[offset] = color[0];
        colors[offset + 1] = color[1];
        colors[offset + 2] = color[2];
        if (mask[index] === 1) {
            highlightedCount++;
        }
    }

    return {
        colors,
        highlightedCount
    };
};

export const buildCategoricalColors = (values: Array<string | null>, atomCount: number): Float32Array => {
    const categories = new Map<string, number>();
    const colors = new Float32Array(atomCount * 3);

    for (let index = 0; index < atomCount; index++) {
        const category = values[index];
        const offset = index * 3;
        if (category === null) {
            colors[offset] = DEFAULT_COLOR[0];
            colors[offset + 1] = DEFAULT_COLOR[1];
            colors[offset + 2] = DEFAULT_COLOR[2];
            continue;
        }

        if (!categories.has(category)) {
            categories.set(category, categories.size);
        }
        const color = CATEGORICAL_PALETTE[(categories.get(category) ?? 0) % CATEGORICAL_PALETTE.length];
        colors[offset] = color[0];
        colors[offset + 1] = color[1];
        colors[offset + 2] = color[2];
    }

    return colors;
};
