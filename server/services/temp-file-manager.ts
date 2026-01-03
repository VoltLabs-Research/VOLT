/**
 * TempFileManager - Centralized temporary file management service.
 * 
 * This service tracks all temporary files generated during job processing
 * and provides centralized cleanup operations. It solves the problem of
 * dispersed cleanup logic across multiple components.
 * 
 * Usage:
 * - Register files during processing: tempFileManager.register(sessionId, filePath)
 * - Cleanup after session: await tempFileManager.cleanupSession(sessionId)
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
     * Registry of files by session ID.
     * Each session can have multiple temp files that need cleanup.
     */
    private registry = new Map<string, Set<string>>();

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
     * Optionally registers it for cleanup.
     */
    generateFilePath(options: {
        prefix?: string,
        extension?: string,
        sessionId?: string,
        subdir?: string
    } = {}): string {
        const { prefix = 'temp_', extension = '', sessionId, subdir } = options;
        const filename = `${prefix}${uuidv4()}${extension}`;

        let dirPath = TEMP_DIR;
        if (subdir) {
            dirPath = path.join(TEMP_DIR, subdir);
        }

        const filePath = path.join(dirPath, filename);

        if (sessionId) {
            this.register(sessionId, filePath);
        }

        return filePath;
    }

    /**
     * Get a subdirectory path within the temp folder.
     */
    getDirPath(subdir: string): string {
        return path.join(TEMP_DIR, subdir);
    }

    /**
     * Register a file or directory for cleanup when its session ends.
     * @param sessionId - Session identifier (analysisId, trajectoryId, etc.)
     * @param filePath - Absolute path to the file or directory
     */
    register(sessionId: string, filePath: string): void {
        if (!this.registry.has(sessionId)) {
            this.registry.set(sessionId, new Set());
        }
        this.registry.get(sessionId)!.add(filePath);
    }

    /**
     * Register multiple files at once.
     */
    registerMany(sessionId: string, filePaths: string[]): void {
        for (const filePath of filePaths) {
            this.register(sessionId, filePath);
        }
    }

    /**
     * Get registered files for a session.
     */
    getRegistered(sessionId: string): string[] {
        return Array.from(this.registry.get(sessionId) || []);
    }

    /**
     * Clean up all files registered for a session.
     * Uses fs.rm with recursive and force options to handle both files and directories.
     * @param sessionId - Session identifier
     * @returns Number of items cleaned up
     */
    async cleanupSession(sessionId: string): Promise<number> {
        const files = this.registry.get(sessionId);
        if (!files || files.size === 0) {
            return 0;
        }

        let cleaned = 0;
        for (const filePath of files) {
            try {
                await fs.rm(filePath, { recursive: true, force: true });
                cleaned++;
            } catch (error) {
                // Log but don't fail - file might already be deleted
                logger.debug(`[TempFileManager] Failed to remove ${filePath}: ${error}`);
            }
        }

        this.registry.delete(sessionId);
        logger.info(`[TempFileManager] Cleaned up ${cleaned} items for session ${sessionId}`);
        return cleaned;
    }

    /**
     * Clean up trajectory dump cache directory.
     * This is a convenience method for the common case of cleaning up
     * trajectory dumps after all analysis jobs complete.
     * @param trajectoryId - Trajectory identifier
     */
    async cleanupTrajectoryDumps(trajectoryId: string): Promise<void> {
        const dumpCacheDir = path.join(TEMP_DIR, trajectoryId);
        logger.info(`[TempFileManager] 🗑️ Attempting to remove dump cache directory: ${dumpCacheDir}`);

        try {
            // Check if directory exists first
            const stats = await fs.stat(dumpCacheDir);
            logger.info(`[TempFileManager] ✅ Directory exists, size info: ${JSON.stringify(stats)}`);

            // List contents before deletion
            const files = await fs.readdir(dumpCacheDir);
            logger.info(`[TempFileManager] 📂 Directory contains ${files.length} files: ${files.join(', ')}`);

            await fs.rm(dumpCacheDir, { recursive: true, force: true });
            logger.info(`[TempFileManager] ✅ Successfully cleaned up dump cache for trajectory ${trajectoryId}`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                logger.info(`[TempFileManager] ℹ️ Dump cache directory does not exist for ${trajectoryId}, nothing to clean`);
            } else {
                logger.error(`[TempFileManager] ❌ Failed to cleanup dumps for ${trajectoryId}: ${error}`);
                throw error;
            }
        }
    }

    /**
     * Clean up all registered sessions.
     * Useful for graceful shutdown.
     */
    async cleanupAll(): Promise<number> {
        let total = 0;
        const sessionIds = Array.from(this.registry.keys());

        for (const sessionId of sessionIds) {
            total += await this.cleanupSession(sessionId);
        }

        logger.info(`[TempFileManager] Full cleanup completed: ${total} items from ${sessionIds.length} sessions`);
        return total;
    }

    /**
     * Clean any stale files in the temp directory that don't belong to active sessions.
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
