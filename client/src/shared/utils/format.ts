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
 * Format a duration in minutes as "Dd Hh", "Hh Mm", "Mm", or "<1m" for fractional values.
 */
export const formatDuration = (minutes: number): string => {
    if(minutes <= 0) return '0m';
    if(minutes < 1) return '<1m';

    const totalMinutes = Math.floor(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if(hours >= 24){
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    if(hours > 0){
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
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
 * Format an unknown runtime value into a safe display string.
 */
export const formatUnknownValue = (value: unknown): string => {
    if(value === null || value === undefined) return '-';
    if(typeof value === 'string') return value;
    if(typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
        return String(value);
    }
    if(value instanceof Date) return value.toISOString();
    if(Array.isArray(value)){
        if(value.length === 0) return '[]';
        const preview = value.slice(0, 3).map(formatUnknownValue).join(', ');
        return value.length > 3 ? `[${preview}, ...]` : `[${preview}]`;
    }
    if(typeof value === 'object'){
        const entries = Object.entries(value as Record<string, unknown>);
        if(entries.length === 0) return '{}';
        const preview = entries
            .slice(0, 3)
            .map(([key, entry]) => `${key}: ${formatUnknownValue(entry)}`)
            .join(', ');
        return entries.length > 3 ? `{${preview}, ...}` : `{${preview}}`;
    }

    try{
        const serialized = JSON.stringify(value);
        return typeof serialized === 'string' ? serialized : String(value);
    }catch{
        return String(value);
    }
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
