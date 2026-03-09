/**
 * Format a number to a human-readable string with K, M, B suffixes
 */
export const formatNumber = (num: number): string => {
    if(num === 0) return '0';
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if(absNum >= 1000000000){
        return sign + (absNum / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
    }
    if(absNum >= 1000000){
        return sign + (absNum / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }
    if(absNum >= 1000){
        return sign + (absNum / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    }
    return sign + absNum.toString();
};

/**
 * Format bytes to human-readable size string
 */
export const formatSize = (bytes: number): string => {
    if(bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get nested value from object by dot-notation path
 */
export const getValueByPath = (obj: unknown, path: string): unknown => {
    if(!obj || typeof obj !== 'object') return undefined;
    const keys = path.split('.');
    let current: unknown = obj;
    for(const key of keys){
        if(current === null || current === undefined) return undefined;
        if(typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
};
