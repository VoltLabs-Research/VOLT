export type InferredCellKind =
    | 'empty'
    | 'boolean'
    | 'integer'
    | 'number'
    | 'string'
    | 'date'
    | 'vector'
    | 'numberArray'
    | 'points'
    | 'matrix'
    | 'object'
    | 'mixed';

export interface InferredColumnType {
    kind: InferredCellKind;
    meta: {
        vectorLength?: number;
        pointsInnerLength?: number;
        sampledCount: number;
    };
}

const SAMPLE_SIZE = 30;
const SHORT_ARRAY_MAX = 4;

export const inferCellKind = (value: unknown): InferredCellKind => {
    if(value === null || value === undefined) return 'empty';
    if(typeof value === 'boolean') return 'boolean';
    if(typeof value === 'number'){
        if(!Number.isFinite(value)) return 'number';
        return Number.isInteger(value) ? 'integer' : 'number';
    }
    if(typeof value === 'bigint') return 'integer';
    if(typeof value === 'string') return 'string';
    if(value instanceof Date) return 'date';

    if(Array.isArray(value)){
        if(value.length === 0) return 'numberArray';

        const allNumbers = value.every((entry) => typeof entry === 'number');
        if(allNumbers){
            return value.length <= SHORT_ARRAY_MAX ? 'vector' : 'numberArray';
        }

        const allArraysOfNumbers = value.every((entry) =>
            Array.isArray(entry) && entry.every((cell) => typeof cell === 'number')
        );
        if(allArraysOfNumbers){
            const inner = value as number[][];
            const firstLength = inner[0]?.length ?? 0;
            const consistent = inner.every((row) => row.length === firstLength);
            if(consistent && firstLength > 0 && firstLength <= SHORT_ARRAY_MAX){
                return 'points';
            }
            return 'matrix';
        }

        return 'mixed';
    }

    if(typeof value === 'object') return 'object';
    return 'mixed';
};

const promoteNumericKind = (a: InferredCellKind, b: InferredCellKind): InferredCellKind => {
    if(a === b) return a;
    if(a === 'empty') return b;
    if(b === 'empty') return a;
    if((a === 'integer' && b === 'number') || (a === 'number' && b === 'integer')){
        return 'number';
    }
    return 'mixed';
};

export const inferColumnType = (values: unknown[]): InferredColumnType => {
    const samples = values.slice(0, SAMPLE_SIZE);
    const meta: InferredColumnType['meta'] = { sampledCount: 0 };
    let kind: InferredCellKind = 'empty';

    for(const value of samples){
        const current = inferCellKind(value);
        if(current === 'empty') continue;

        meta.sampledCount += 1;

        if(current === 'vector' && Array.isArray(value)){
            meta.vectorLength = meta.vectorLength ?? value.length;
        }
        if(current === 'points' && Array.isArray(value) && Array.isArray(value[0])){
            meta.pointsInnerLength = meta.pointsInnerLength ?? (value[0] as unknown[]).length;
        }

        if(kind === 'empty'){
            kind = current;
            continue;
        }

        kind = promoteNumericKind(kind, current);
        if(kind === 'mixed') break;
    }

    return { kind, meta };
};
