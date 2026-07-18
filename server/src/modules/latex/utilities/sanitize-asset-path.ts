import path from 'node:path';

/**
 * Sanitizes a user-supplied asset path to a safe relative POSIX path.
 *
 * Rules enforced:
 * - Normalizes backslashes to forward slashes.
 * - Strips leading slashes so the result is always relative.
 * - Collapses `..` components to prevent path-traversal escapes.
 * - Filters empty segments produced by double slashes.
 * - Falls back to `originalName` (basename only) when the sanitized
 *   result would be empty.
 *
 * @param assetPath   - The raw path string submitted by the client.
 * @param originalName - Fallback name used when `assetPath` is blank or
 *                       reduces to an empty string after sanitization.
 * @returns A non-empty, relative, forward-slash-separated path string.
 */
export const sanitizeAssetPath = (assetPath: string, originalName: string): string => {
    const normalized = assetPath.replace(/\\/g, '/');
    const segments = normalized
        .split('/')
        .filter((seg) => seg.length > 0 && seg !== '.');

    const safe: string[] = [];
    for (const seg of segments) {
        if (seg === '..') {
            safe.pop();
        } else {
            safe.push(seg);
        }
    }

    const result = safe.join('/');
    if (!result) {
        return path.basename(originalName);
    }

    return result;
};
