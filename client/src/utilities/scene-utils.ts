export const deepMerge = <T extends object>(base: T, patch: Partial<T>): T => {
    const out: any = Array.isArray(base) ? [...base] : { ...base };
    for(const key in patch){
        const value: any = patch[key];
        if(value === undefined) continue;
        if(Array.isArray(value)){
            out[key] = [...value];
        }else if(value && typeof value === 'object' && !Array.isArray(value)){
            out[key] = deepMerge((out[key] ?? {}) as any, value);
        }else{
            out[key] = value;
        }
    }

    return out;
};

export const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = bytes / Math.pow(1024, i)
    return `${value.toFixed(2).replace(/\.?0+$/, '')} ${units[i]}`
}

export const formatNumber = (n?: number) => {
    if(Number.isFinite(n)){
        return new Intl.NumberFormat().format(n as number);
    }

    return '-';
};