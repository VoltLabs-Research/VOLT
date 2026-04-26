export interface FormattedScientific {
    short: string;
    long: string;
}

export const formatScientific = (value: number, sigFigs = 4): FormattedScientific => {
    if(!Number.isFinite(value)){
        const text = String(value);
        return { short: text, long: text };
    }

    if(value === 0){
        return { short: '0', long: '0' };
    }

    const abs = Math.abs(value);
    const long = String(value);

    if(Number.isInteger(value) && abs < 1e6){
        return { short: long, long };
    }

    if(abs >= 1e6 || abs < 1e-3){
        return { short: value.toExponential(Math.max(sigFigs - 1, 1)), long };
    }

    const precision = Number(value.toPrecision(sigFigs));
    return { short: String(precision), long };
};

export const vectorMagnitude = (components: number[]): number => {
    let sum = 0;
    for(const component of components){
        sum += component * component;
    }
    return Math.sqrt(sum);
};

export const summarizeScalar = (value: unknown): string => {
    if(value === null || value === undefined) return '-';
    if(typeof value === 'boolean') return value ? 'true' : 'false';
    if(typeof value === 'number') return formatScientific(value, 3).short;
    if(typeof value === 'bigint') return value.toString();
    if(typeof value === 'string'){
        return value.length > 14 ? `${value.slice(0, 13)}…` : value;
    }
    if(value instanceof Date) return value.toISOString();

    if(Array.isArray(value)){
        if(value.length === 0) return '[]';
        if(value.every((entry) => typeof entry === 'number')){
            const nums = value as number[];
            const sample = nums.slice(0, 3).map((n) => formatScientific(n, 3).short).join(', ');
            return nums.length > 3 ? `[${sample}, …]` : `[${sample}]`;
        }
        return `[${value.length}]`;
    }

    if(typeof value === 'object') return '{…}';
    return String(value);
};

export const safeJsonStringify = (value: unknown): string => {
    try{
        const serialized = JSON.stringify(value);
        return typeof serialized === 'string' ? serialized : String(value);
    }catch{
        return String(value);
    }
};
