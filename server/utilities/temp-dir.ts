import * as path from 'node:path';

/**
 * Base temp directory for all temporary files.
 * Uses the project's storage/temp folder instead of system /tmp.
 */
export const TEMP_DIR = path.resolve(__dirname, '../storage/temp');

/**
 * Get a subdirectory within the temp folder
 */
export const getTempSubdir = (subdir: string): string => {
    return path.join(TEMP_DIR, subdir);
};
