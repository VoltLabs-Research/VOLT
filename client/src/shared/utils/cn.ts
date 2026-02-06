type ClassValue = string | boolean | undefined | null;

/**
 * Utility for constructing className strings conditionally.
 * Filters out falsy values and joins with space.
 * 
 * @example
 * cn('btn', isActive && 'btn-active', className)
 * // => 'btn btn-active custom-class'
 */
export const cn = (...classes: ClassValue[]): string => {
    return classes.filter(Boolean).join(' ');
};
