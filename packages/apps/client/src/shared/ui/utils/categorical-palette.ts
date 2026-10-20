const CATEGORICAL_PALETTE = [
    '#ef4444',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316'
] as const;

const hashKey = (key: string): number => {
    let hash = 0;
    for(let index = 0; index < key.length; index += 1){
        hash = (hash * 31 + key.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

export const getCategoricalColor = (key: string): string => {
    if(!key) return CATEGORICAL_PALETTE[0];

    return CATEGORICAL_PALETTE[hashKey(key) % CATEGORICAL_PALETTE.length];
};

export const getCategoricalColorByIndex = (index: number): string => {
    if(!Number.isFinite(index)) return CATEGORICAL_PALETTE[0];

    const zeroBased = Math.max(0, Math.floor(index) - 1);
    return CATEGORICAL_PALETTE[zeroBased % CATEGORICAL_PALETTE.length];
};
