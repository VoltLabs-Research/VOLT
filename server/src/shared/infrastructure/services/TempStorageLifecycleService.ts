import type { ITempStorageLifecycleService } from '@shared/domain/port/ITempStorageLifecycleService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TempFileService from '@shared/infrastructure/services/TempFileService';
import fs from 'node:fs/promises';
import path from 'node:path';

interface TempStoragePolicyMatcher {
    value: string;
    mode: TempStoragePolicyMatchMode;
};

interface TempStorageCleanupPolicy {
    name: string;
    matcher: TempStoragePolicyMatcher;
    execute: (entryPath: string) => Promise<void>;
};

enum TempStoragePolicyMatchMode {
    Exact = 'exact',
    Prefix = 'prefix'
};

const HOUR_IN_MS = 60 * 60 * 1000;
const TEMP_STORAGE_CLEANUP_INTERVAL_MS = HOUR_IN_MS;
const TRAJECTORY_CACHE_MAX_AGE_MS = 48 * HOUR_IN_MS;
const PLUGIN_BINARY_CACHE_MAX_AGE_MS = 7 * 24 * HOUR_IN_MS;
const PLUGIN_BINARY_TEMP_MAX_AGE_MS = 2 * HOUR_IN_MS;
const TRAJECTORY_UPLOAD_WORKDIR_MAX_AGE_MS = 24 * HOUR_IN_MS;
const LATEX_WORKDIR_MAX_AGE_MS = 24 * HOUR_IN_MS;
const PLUGIN_BINARY_TEMP_SEGMENT = '.tmp.';

const toMilliseconds = (value: number | bigint): number => {
    return typeof value === 'bigint'
        ? Number(value)
        : value;
};

/**
 * Manages startup and periodic cleanup for known temp-storage producers.
 */
@Singleton()
export default class TempStorageLifecycleService implements ITempStorageLifecycleService {
    private readonly tempRootPath: string;
    private readonly policies: TempStorageCleanupPolicy[];
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        
        private readonly tempFileService: TempFileService
    ) {
        this.tempRootPath = this.tempFileService.rootPath;
        this.policies = [
            {
                name: 'trajectory-cache',
                matcher: {
                    value: 'trajectory-cache',
                    mode: TempStoragePolicyMatchMode.Exact
                },
                execute: this.cleanupTrajectoryCache.bind(this)
            },
            {
                name: 'plugin-bin-cache',
                matcher: {
                    value: 'plugin-bin-cache',
                    mode: TempStoragePolicyMatchMode.Exact
                },
                execute: this.cleanupPluginBinaryCache.bind(this)
            },
            {
                name: 'trajectory-uploads',
                matcher: {
                    value: 'trajectory-uploads',
                    mode: TempStoragePolicyMatchMode.Exact
                },
                execute: this.cleanupTrajectoryUploads.bind(this)
            },
            {
                name: 'latex-compile',
                matcher: {
                    value: 'latex-compile-',
                    mode: TempStoragePolicyMatchMode.Prefix
                },
                execute: this.cleanupLatexWorkdir.bind(this)
            },
            {
                name: 'latex-fix',
                matcher: {
                    value: 'latex-fix-',
                    mode: TempStoragePolicyMatchMode.Prefix
                },
                execute: this.cleanupLatexWorkdir.bind(this)
            }
        ];
    }

    public async start(): Promise<void> {
        if (this.cleanupTimer) {
            return;
        }

        await this.runCleanupCycle();

        this.cleanupTimer = setInterval(() => {
            this.runCleanupCycle().catch(() => {
                logger.warn(`@temp-storage-lifecycle-service: periodic cleanup failed`);
            });
        }, TEMP_STORAGE_CLEANUP_INTERVAL_MS);
        this.cleanupTimer.unref();
    }

    public stop(): void {
        if (!this.cleanupTimer) {
            return;
        }

        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
    }

    public async runCleanupCycle(): Promise<void> {
        await fs.mkdir(this.tempRootPath, { recursive: true });

        const rootEntries = await fs.readdir(this.tempRootPath, { withFileTypes: true });

        for (const entry of rootEntries) {
            const policy = this.getPolicy(entry.name);
            if (!policy) {
                continue;
            }

            const entryPath = path.join(this.tempRootPath, entry.name);

            try {
                await policy.execute(entryPath);
            } catch (error: unknown) {
                logger.warn(`@temp-storage-lifecycle-service: cleanup policy failed entryName=${entry.name} policy=${policy.name}`);
            }
        }
    }

    private getPolicy(entryName: string): TempStorageCleanupPolicy | undefined {
        return this.policies.find((policy) => {
            if (policy.matcher.mode === TempStoragePolicyMatchMode.Exact) {
                return policy.matcher.value === entryName;
            }

            return entryName.startsWith(policy.matcher.value);
        });
    }

    private async cleanupTrajectoryCache(cacheRootPath: string): Promise<void> {
        const cacheEntries = await fs.readdir(cacheRootPath, { withFileTypes: true }).catch(() => []);

        for (const entry of cacheEntries) {
            const entryPath = path.join(cacheRootPath, entry.name);
            await this.cleanupTrajectoryCacheEntry(entryPath);
        }
    }

    private async cleanupTrajectoryCacheEntry(entryPath: string): Promise<boolean> {
        const stats = await this.safeLstat(entryPath);
        if (!stats) {
            return false;
        }

        if (!stats.isDirectory()) {
            if (this.isExpired(toMilliseconds(stats.mtimeMs), TRAJECTORY_CACHE_MAX_AGE_MS)) {
                return this.deleteManagedPath(entryPath, false);
            }

            return false;
        }

        const childEntries = await fs.readdir(entryPath, { withFileTypes: true }).catch(() => []);
        let deletedStaleChild = false;

        for (const childEntry of childEntries) {
            const childPath = path.join(entryPath, childEntry.name);
            const childDeleted = await this.cleanupTrajectoryCacheEntry(childPath);
            deletedStaleChild = childDeleted || deletedStaleChild;
        }

        if (await this.isDirectoryEmpty(entryPath) && (deletedStaleChild || this.isExpired(toMilliseconds(stats.mtimeMs), TRAJECTORY_CACHE_MAX_AGE_MS))) {
            return this.deleteManagedPath(entryPath, true);
        }

        return deletedStaleChild;
    }

    private async cleanupPluginBinaryCache(cacheRootPath: string): Promise<void> {
        const cacheEntries = await fs.readdir(cacheRootPath, { withFileTypes: true }).catch(() => []);

        for (const entry of cacheEntries) {
            const entryPath = path.join(cacheRootPath, entry.name);
            const stats = await this.safeLstat(entryPath);
            if (!stats || stats.isDirectory()) {
                continue;
            }

            let maxAgeMs = PLUGIN_BINARY_CACHE_MAX_AGE_MS;
            if (entry.name.includes(PLUGIN_BINARY_TEMP_SEGMENT)) {
                maxAgeMs = PLUGIN_BINARY_TEMP_MAX_AGE_MS;
            }

            if (!this.isExpired(toMilliseconds(stats.mtimeMs), maxAgeMs)) {
                continue;
            }

            await this.deleteManagedPath(entryPath, false);
        }
    }

    private async cleanupTrajectoryUploads(uploadsRootPath: string): Promise<void> {
        await this.cleanupStaleChildren(uploadsRootPath, TRAJECTORY_UPLOAD_WORKDIR_MAX_AGE_MS);
    }

    private async cleanupLatexWorkdir(workdirPath: string): Promise<void> {
        await this.cleanupStaleTree(workdirPath, LATEX_WORKDIR_MAX_AGE_MS);
    }

    private async cleanupStaleChildren(parentPath: string, maxAgeMs: number): Promise<void> {
        const childEntries = await fs.readdir(parentPath, { withFileTypes: true }).catch(() => []);

        for (const childEntry of childEntries) {
            const childPath = path.join(parentPath, childEntry.name);
            await this.cleanupStaleTree(childPath, maxAgeMs);
        }
    }

    private async cleanupStaleTree(targetPath: string, maxAgeMs: number): Promise<void> {
        const newestMtimeMs = await this.getNewestManagedMtimeMs(targetPath);
        if (newestMtimeMs === null || !this.isExpired(newestMtimeMs, maxAgeMs)) {
            return;
        }

        await this.deleteManagedPath(targetPath, true);
    }

    private async getNewestManagedMtimeMs(targetPath: string): Promise<number | null> {
        const stats = await this.safeLstat(targetPath);
        if (!stats) {
            return null;
        }

        let newestMtimeMs = toMilliseconds(stats.mtimeMs);
        if (!stats.isDirectory()) {
            return newestMtimeMs;
        }

        const childEntries = await fs.readdir(targetPath, { withFileTypes: true }).catch(() => []);
        for (const childEntry of childEntries) {
            const childPath = path.join(targetPath, childEntry.name);
            const childNewestMtimeMs = await this.getNewestManagedMtimeMs(childPath);
            if (childNewestMtimeMs !== null && childNewestMtimeMs > newestMtimeMs) {
                newestMtimeMs = childNewestMtimeMs;
            }
        }

        return newestMtimeMs;
    }

    private async safeLstat(targetPath: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
        try {
            if (!this.isWithinTempRoot(targetPath)) {
                logger.warn(`@temp-storage-lifecycle-service: refusing to inspect path outside temp root targetPath=${targetPath}`);
                return null;
            }

            return await fs.lstat(targetPath);
        } catch {
            return null;
        }
    }

    private isWithinTempRoot(targetPath: string): boolean {
        const resolvedPath = path.resolve(targetPath);
        const relativePath = path.relative(this.tempRootPath, resolvedPath);

        return relativePath === ''
            || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
    }

    private isExpired(modifiedAtMs: number, maxAgeMs: number): boolean {
        return (this.getNow().getTime() - modifiedAtMs) > maxAgeMs;
    }

    protected getNow(): Date {
        return new Date();
    }

    private async deleteManagedPath(targetPath: string, recursive: boolean): Promise<boolean> {
        if (!this.isWithinTempRoot(targetPath)) {
            logger.warn(`@temp-storage-lifecycle-service: refusing to delete path outside temp root targetPath=${targetPath}`);
            return false;
        }

        try {
            return await this.tempFileService.delete(targetPath, {
                recursive,
                force: true
            });
        } catch (error: unknown) {
            logger.warn(`@temp-storage-lifecycle-service: failed to delete temp path targetPath=${targetPath}`);
            return false;
        }
    }

    private async isDirectoryEmpty(directoryPath: string): Promise<boolean> {
        try {
            const entries = await fs.readdir(directoryPath);
            return entries.length === 0;
        } catch {
            return false;
        }
    }
};
