import * as path from 'node:path';

export const TEMP_DIR = path.resolve(process.cwd(), 'storage/temp');

/**
 * Get a subdirectory within the temp folder
 */
export const getTempSubdir = (subdir: string): string => {
    return path.join(TEMP_DIR, subdir);
};

