import { singleton } from '@shared/application/utilities/singleton';
import type { SharedFrameColumn, SharedFramePublishInput } from '@shared/contracts/types/shared-frame';
import { logger } from '@shared/infrastructure/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PluginFrameColumnBinding } from '@shared/contracts/types/plugin-batch';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';

const DEFAULT_FRAME_MMAP_ROOT = path.resolve(process.cwd(), 'storage', 'plugin-frames');
const FRAME_MMAP_ROOT_ENV = 'PLUGIN_FRAME_MMAP_DIR';
const FRAME_MMAP_FILE_PREFIX = 'volt-plugin-frame-';

interface SharedFrameHandle {
    path: string | null;
    bindings: PluginFrameColumnBinding[];
    release(): Promise<void>;
}

const toBufferView = (view: ArrayBufferView): Buffer => {
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
};

const resolveFrameMmapRoot = (): string => {
    const configuredRoot = process.env[FRAME_MMAP_ROOT_ENV]?.trim();
    return path.resolve(configuredRoot || DEFAULT_FRAME_MMAP_ROOT);
};

export class SharedMemoryBridge {
    private storageRootPromise: Promise<string> | null = null;

    async publishFrame(input: SharedFramePublishInput): Promise<SharedFrameHandle> {
        if (!input.columns.length) {
            return {
                path: null,
                bindings: [],
                release: async () => {}
            };
        }

        const storageRoot = await this.prepareStorageRoot();
        const filePath = path.join(storageRoot, `${FRAME_MMAP_FILE_PREFIX}${randomUUID()}`);

        try {
            return {
                path: filePath,
                bindings: await this.writeColumnsToFile(filePath, input.columns),
                release: async () => {
                    await safeRemovePath(filePath);
                }
            };
        } catch (error: unknown) {
            await safeRemovePath(filePath).catch(() => undefined);
            logger.error({
                err: error,
                filePath
            }, '@shared-memory-bridge: failed to publish frame mmap file');
            throw error;
        }
    }

    private async writeColumnsToFile(
        filePath: string,
        columns: SharedFrameColumn[]
    ): Promise<PluginFrameColumnBinding[]> {
        const blocks = columns.map((column) => ({
            column,
            view: toBufferView(column.data)
        }));
        const bindings: PluginFrameColumnBinding[] = [];
        let cursor = 0;
        const fileHandle = await fs.open(filePath, 'wx', 0o600);

        try {
            for (const block of blocks) {
                await fileHandle.write(block.view, 0, block.view.byteLength, cursor);
                bindings.push({
                    name: block.column.name,
                    dtype: block.column.dtype,
                    shape: block.column.shape,
                    binding: {
                        kind: 'mmap',
                        offset: cursor,
                        length: block.view.byteLength,
                        dtype: block.column.dtype
                    }
                });
                cursor += block.view.byteLength;
            }
        } finally {
            await fileHandle.close();
        }

        return bindings;
    }

    private prepareStorageRoot(): Promise<string> {
        if (!this.storageRootPromise) {
            this.storageRootPromise = (async () => {
                const storageRoot = resolveFrameMmapRoot();
                await fs.mkdir(storageRoot, { recursive: true });
                await this.cleanupStaleFrameFiles(storageRoot);
                return storageRoot;
            })();
        }

        return this.storageRootPromise;
    }

    private async cleanupStaleFrameFiles(storageRoot: string): Promise<void> {
        let entries: string[];
        try {
            entries = await fs.readdir(storageRoot);
        } catch (error: unknown) {
            logger.warn({
                err: error,
                storageRoot
            }, '@shared-memory-bridge: failed to list stale frame mmap files');
            return;
        }

        await Promise.all(entries
            .filter((entry) => entry.startsWith(FRAME_MMAP_FILE_PREFIX))
            .map((entry) => safeRemovePath(path.join(storageRoot, entry)).catch((error: unknown) => {
                logger.warn(
                    {
                        err: error,
                        filePath: path.join(storageRoot, entry)
                    },
                    '@shared-memory-bridge: failed to remove stale frame mmap file'
                );
            })));
    }
}

export const getSharedMemoryBridge = singleton((): SharedMemoryBridge => new SharedMemoryBridge());
