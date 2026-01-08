/**
 * TempFileManager - Centralized temporary file management service.
 * 
 * Provides utilities for generating temp file paths, ensuring directories exist,
 * and performing generic cleanup operations.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import logger from '@/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base temp directory for all temporary files.
 * Uses the project's storage/temp folder instead of system /tmp.
 */
const TEMP_DIR = path.resolve(__dirname, '../storage/temp');

class TempFileManager {
    /**
     * Get the root temporary directory path.
     */
    get rootPath(): string {
        return TEMP_DIR;
    }

    /**
     * Ensure a directory exists.
     * @param dirPath - Directory path to ensure
     */
    async ensureDir(dirPath: string): Promise<void> {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Generate a unique temporary file path.
     */
    generateFilePath(options: {
        prefix?: string,
        extension?: string,
        subdir?: string
    } = {}): string {
        const { prefix = 'temp_', extension = '', subdir } = options;
        const filename = `${prefix}${uuidv4()}${extension}`;

        let dirPath = TEMP_DIR;
        if (subdir) {
            dirPath = path.join(TEMP_DIR, subdir);
        }

        return path.join(dirPath, filename);
    }

    /**
     * Get a subdirectory path within the temp folder.
     */
    getDirPath(subdir: string): string {
        return path.join(TEMP_DIR, subdir);
    }

    /**
     * Delete a specific file or directory.
     */
    async delete(targetPath: string, options: { recursive?: boolean, force?: boolean } = {}): Promise<boolean> {
        try {
            // Safety check: Ensure path is within temp dir
            const resolvedPath = path.resolve(targetPath);
            if (!resolvedPath.startsWith(TEMP_DIR)) {
                logger.warn(`[TempFileManager] Refusing to delete path outside temp dir: ${resolvedPath}`);
                return false;
            }

            await fs.rm(targetPath, {
                recursive: options.recursive ?? false,
                force: options.force ?? true
            });
            return true;
        } catch (error) {
            logger.debug(`[TempFileManager] Failed to delete ${targetPath}: ${error}`);
            return false;
        }
    }

    /**
     * Clean any stale files in the temp directory.
     * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
     */
    async cleanupStale(maxAgeMs: number = 60 * 60 * 1000): Promise<number> {
        let cleaned = 0;
        const now = Date.now();

        try {
            const entries = await fs.readdir(TEMP_DIR, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(TEMP_DIR, entry.name);
                try {
                    const stats = await fs.stat(fullPath);
                    const age = now - stats.mtimeMs;

                    if (age > maxAgeMs) {
                        await fs.rm(fullPath, { recursive: true, force: true });
                        cleaned++;
                        logger.debug(`[TempFileManager] Removed stale: ${entry.name} (age: ${Math.round(age / 1000 / 60)}min)`);
                    }
                } catch {
                    // Skip if can't stat or remove
                }
            }
        } catch (error) {
            logger.error(`[TempFileManager] Failed to scan temp directory: ${error}`);
        }

        if (cleaned > 0) {
            logger.info(`[TempFileManager] Stale cleanup: removed ${cleaned} items`);
        }
        return cleaned;
    }
}

export default new TempFileManager();
