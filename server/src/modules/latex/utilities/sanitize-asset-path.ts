import path from 'node:path';

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
