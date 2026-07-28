/**
 * Escapes regex metacharacters so user-supplied search text is matched
 * literally by `RegExp` or a Mongo `$regex` filter.
 */
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
