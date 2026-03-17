import 'reflect-metadata';

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import TempStorageLifecycleService from '@shared/infrastructure/services/TempStorageLifecycleService';
import type { DeleteOptions, ITempFileService, TempFileOptions } from '@shared/domain/port/ITempFileService';

interface TestPaths {
    outsideRootPath: string;
    tempRootPath: string;
};

class StubTempFileService implements ITempFileService {
    constructor(
        public readonly rootPath: string
    ) {}

    async ensureDir(dirPath: string): Promise<void> {
        await fs.mkdir(dirPath, { recursive: true });
    }

    generateFilePath(options?: TempFileOptions): string {
        const prefix = options?.prefix ?? 'temp_';
        const extension = options?.extension ?? '';
        const subdirPath = options?.subdir ? this.getDirPath(options.subdir) : this.rootPath;

        return path.join(subdirPath, `${prefix}generated${extension}`);
    }

    getDirPath(subdir: string): string {
        return path.join(this.rootPath, subdir);
    }

    async delete(targetPath: string, options?: DeleteOptions): Promise<boolean> {
        await fs.rm(targetPath, {
            recursive: options?.recursive ?? false,
            force: options?.force ?? true
        });
        return true;
    }
};

class TestTempStorageLifecycleService extends TempStorageLifecycleService {
    constructor(
        tempFileService: ITempFileService,
        private currentTime: Date
    ) {
        super(tempFileService);
    }

    setCurrentTime(currentTime: Date): void {
        this.currentTime = currentTime;
    }

    protected getNow(): Date {
        return this.currentTime;
    }
};

const createTestPaths = async (): Promise<TestPaths> => {
    const baseRootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'volt-temp-lifecycle-'));
    const tempRootPath = path.join(baseRootPath, 'storage', 'temp');
    const outsideRootPath = path.join(baseRootPath, 'outside');

    await fs.mkdir(tempRootPath, { recursive: true });
    await fs.mkdir(outsideRootPath, { recursive: true });

    return {
        outsideRootPath,
        tempRootPath
    };
};

const setPathAge = async (targetPath: string, ageMs: number, referenceTime: Date): Promise<void> => {
    const modifiedAt = new Date(referenceTime.getTime() - ageMs);
    await fs.utimes(targetPath, modifiedAt, modifiedAt);
};

const writeFile = async (filePath: string, contents: string): Promise<void> => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents, 'utf-8');
};

test('TempStorageLifecycleService deletes expired managed leftovers and keeps unknown entries untouched', async (t) => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    const paths = await createTestPaths();
    const service = new TestTempStorageLifecycleService(new StubTempFileService(paths.tempRootPath), now);

    t.after(async () => {
        service.stop();
        await fs.rm(path.dirname(path.dirname(paths.tempRootPath)), { recursive: true, force: true });
    });

    const oldTrajectoryDumpPath = path.join(paths.tempRootPath, 'trajectory-cache', 'trajectory-a', '0.dump');
    const oldPluginBinaryPath = path.join(paths.tempRootPath, 'plugin-bin-cache', 'plugin-a-binary');
    const oldPluginTempPath = path.join(paths.tempRootPath, 'plugin-bin-cache', 'plugin-a-binary.tmp.123');
    const oldUploadWorkdirPath = path.join(paths.tempRootPath, 'trajectory-uploads', 'trajectory-a');
    const oldLatexCompilePath = path.join(paths.tempRootPath, 'latex-compile-stale');
    const unknownPath = path.join(paths.tempRootPath, 'unknown-producer');

    await writeFile(oldTrajectoryDumpPath, 'trajectory dump');
    await writeFile(oldPluginBinaryPath, 'binary');
    await writeFile(oldPluginTempPath, 'temp binary');
    await writeFile(path.join(oldUploadWorkdirPath, 'frame.dump'), 'upload frame');
    await writeFile(path.join(oldLatexCompilePath, 'main.tex'), '\\documentclass{article}');
    await writeFile(path.join(unknownPath, 'keep.txt'), 'unknown');

    await setPathAge(oldTrajectoryDumpPath, 49 * 60 * 60 * 1000, now);
    await setPathAge(path.dirname(oldTrajectoryDumpPath), 49 * 60 * 60 * 1000, now);
    await setPathAge(oldPluginBinaryPath, 8 * 24 * 60 * 60 * 1000, now);
    await setPathAge(oldPluginTempPath, 3 * 60 * 60 * 1000, now);
    await setPathAge(path.join(oldUploadWorkdirPath, 'frame.dump'), 25 * 60 * 60 * 1000, now);
    await setPathAge(oldUploadWorkdirPath, 25 * 60 * 60 * 1000, now);
    await setPathAge(path.join(oldLatexCompilePath, 'main.tex'), 25 * 60 * 60 * 1000, now);
    await setPathAge(oldLatexCompilePath, 25 * 60 * 60 * 1000, now);

    await service.runCleanupCycle();

    await assert.rejects(fs.access(oldTrajectoryDumpPath));
    await assert.rejects(fs.access(path.dirname(oldTrajectoryDumpPath)));
    await assert.rejects(fs.access(oldPluginBinaryPath));
    await assert.rejects(fs.access(oldPluginTempPath));
    await assert.rejects(fs.access(oldUploadWorkdirPath));
    await assert.rejects(fs.access(oldLatexCompilePath));
    await assert.doesNotReject(fs.access(path.join(unknownPath, 'keep.txt')));
});

test('TempStorageLifecycleService preserves recent and active-looking temp paths', async (t) => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    const paths = await createTestPaths();
    const service = new TestTempStorageLifecycleService(new StubTempFileService(paths.tempRootPath), now);

    t.after(async () => {
        service.stop();
        await fs.rm(path.dirname(path.dirname(paths.tempRootPath)), { recursive: true, force: true });
    });

    const recentPluginBinaryPath = path.join(paths.tempRootPath, 'plugin-bin-cache', 'plugin-recent');
    const activeLatexWorkdirPath = path.join(paths.tempRootPath, 'latex-fix-active');
    const activeLatexChildPath = path.join(activeLatexWorkdirPath, 'recent.log');
    const recentUploadWorkdirPath = path.join(paths.tempRootPath, 'trajectory-uploads', 'trajectory-recent');
    const recentTrajectoryDumpPath = path.join(paths.tempRootPath, 'trajectory-cache', 'trajectory-recent', '1.dump');

    await writeFile(recentPluginBinaryPath, 'binary');
    await writeFile(activeLatexChildPath, 'compiler log');
    await writeFile(path.join(recentUploadWorkdirPath, 'frame.dump'), 'recent upload');
    await writeFile(recentTrajectoryDumpPath, 'recent frame');

    await setPathAge(recentPluginBinaryPath, 2 * 24 * 60 * 60 * 1000, now);
    await setPathAge(activeLatexWorkdirPath, 30 * 60 * 60 * 1000, now);
    await setPathAge(activeLatexChildPath, 5 * 60 * 1000, now);
    await setPathAge(path.join(recentUploadWorkdirPath, 'frame.dump'), 5 * 60 * 1000, now);
    await setPathAge(recentUploadWorkdirPath, 5 * 60 * 1000, now);
    await setPathAge(recentTrajectoryDumpPath, 2 * 60 * 60 * 1000, now);

    await service.runCleanupCycle();

    await assert.doesNotReject(fs.access(recentPluginBinaryPath));
    await assert.doesNotReject(fs.access(activeLatexWorkdirPath));
    await assert.doesNotReject(fs.access(recentUploadWorkdirPath));
    await assert.doesNotReject(fs.access(recentTrajectoryDumpPath));
});

test('TempStorageLifecycleService startup cleanup runs before scheduling the periodic timer', async (t) => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    const paths = await createTestPaths();
    const service = new TestTempStorageLifecycleService(new StubTempFileService(paths.tempRootPath), now);

    t.after(async () => {
        service.stop();
        await fs.rm(path.dirname(path.dirname(paths.tempRootPath)), { recursive: true, force: true });
    });

    const stalePluginTempPath = path.join(paths.tempRootPath, 'plugin-bin-cache', 'plugin-startup.tmp.777');
    await writeFile(stalePluginTempPath, 'temp');
    await setPathAge(stalePluginTempPath, 3 * 60 * 60 * 1000, now);

    await service.start();

    await assert.rejects(fs.access(stalePluginTempPath));
});

test('TempStorageLifecycleService removes only in-root symlinks and never deletes outside temp root targets', async (t) => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    const paths = await createTestPaths();
    const service = new TestTempStorageLifecycleService(new StubTempFileService(paths.tempRootPath), now);

    t.after(async () => {
        service.stop();
        await fs.rm(path.dirname(path.dirname(paths.tempRootPath)), { recursive: true, force: true });
    });

    const outsideTargetPath = path.join(paths.outsideRootPath, 'plugin-target');
    const inRootSymlinkPath = path.join(paths.tempRootPath, 'plugin-bin-cache', 'plugin-link.tmp.999');

    await writeFile(outsideTargetPath, 'outside binary');
    await fs.mkdir(path.dirname(inRootSymlinkPath), { recursive: true });
    await fs.symlink(outsideTargetPath, inRootSymlinkPath);
    await setPathAge(inRootSymlinkPath, 3 * 60 * 60 * 1000, now);

    await service.runCleanupCycle();

    await assert.rejects(fs.lstat(inRootSymlinkPath));
    await assert.doesNotReject(fs.access(outsideTargetPath));
});
