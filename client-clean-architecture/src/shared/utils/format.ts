import { formatDistanceToNow, format } from 'date-fns';

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
    const i = Math.floor(Math.log(bytes) / Math.log(k));
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

/**
 * Parse a date value safely
 */
const parseDate = (value: Date | string | unknown): Date | null => {
    if(!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return isNaN(date.getTime()) ? null : date;
};

/**
 * Format date as relative time (e.g., "2 hours ago", "3 days ago")
 */
export const formatRelativeDate = (value: Date | string | unknown): string => {
    const date = parseDate(value);
    if(!date) return '-';
    return formatDistanceToNow(date, { addSuffix: true });
};

/**
 * Format date as full date (e.g., "January 15, 2024")
 */
export const formatFullDate = (value: Date | string | unknown): string => {
    const date = parseDate(value);
    if(!date) return 'Never';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Format date as short date with time (e.g., "Jan 15, 3:30 PM")
 */
export const formatShortDate = (value: Date | string | unknown): string => {
    const date = parseDate(value);
    if(!date) return '-';
    return format(date, 'MMM d, h:mm a');
};
