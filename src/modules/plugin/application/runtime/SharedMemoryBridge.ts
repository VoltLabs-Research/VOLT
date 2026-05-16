import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PluginFrameColumnBinding } from '@/modules/plugin/contracts/plugin-batch';
import { safeRemovePath } from '@/support/fs/safe-remove-path';

const DEFAULT_FRAME_MMAP_ROOT = path.resolve(process.cwd(), 'storage', 'plugin-frames');
const FRAME_MMAP_ROOT_ENV = 'PLUGIN_FRAME_MMAP_DIR';
const FRAME_MMAP_FILE_PREFIX = 'volt-plugin-frame-';

export interface SharedFrameColumn {
    name: string;
    dtype: string;
    shape: number[];
    data: ArrayBufferView;
}

export interface SharedFramePublishInput {
    columns: SharedFrameColumn[];
}

export interface SharedFrameHandle {
    id: string;
    path: string | null;
    mode: 'mmap' | 'inline';
    size: number;
    bindings: PluginFrameColumnBinding[];
    inlinePayload?: SharedFrameInlinePayload;
    release(): Promise<void>;
}

export interface SharedFrameInlinePayload {
    columns: Array<{
        name: string;
        dtype: string;
        shape: number[];
        bytes: Buffer;
    }>;
}

const toBufferView = (view: ArrayBufferView): Buffer => {
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
};

const resolveFrameMmapRoot = (): string => {
    const configuredRoot = process.env[FRAME_MMAP_ROOT_ENV]?.trim();
    return path.resolve(configuredRoot || DEFAULT_FRAME_MMAP_ROOT);
};

@Service('sharedMemoryBridge')
export class SharedMemoryBridge {
    private storageRootPromise: Promise<string> | null = null;

    async publishFrame(input: SharedFramePublishInput): Promise<SharedFrameHandle> {
        if (!input.columns.length) {
            return this.buildInlineHandle(randomUUID(), input);
        }

        const storageRoot = await this.prepareStorageRoot();
        const id = randomUUID();
        const filename = `${FRAME_MMAP_FILE_PREFIX}${id}`;
        const filePath = path.join(storageRoot, filename);

        try {
            const { bindings, totalBytes } = await this.writeColumnsToFile(filePath, input.columns);

            const handle: SharedFrameHandle = {
                id,
                path: filePath,
                mode: 'mmap',
                size: totalBytes,
                bindings,
                release: async () => {
                    await safeRemovePath(filePath);
                }
            };
            return handle;
        } catch (error: unknown) {
            await safeRemovePath(filePath).catch(() => undefined);
            logger.error({ err: error, filePath }, '@shared-memory-bridge: failed to publish frame mmap file');
            throw error;
        }
    }

    private buildInlineHandle(id: string, input: SharedFramePublishInput): SharedFrameHandle {
        const columns = input.columns.map((column) => ({
            name: column.name,
            dtype: column.dtype,
            shape: column.shape,
            bytes: Buffer.from(toBufferView(column.data))
        }));
        const bindings: PluginFrameColumnBinding[] = columns.map((column) => ({
            name: column.name,
            dtype: column.dtype,
            shape: column.shape,
            binding: {
                kind: 'inline',
                dtype: column.dtype,
                length: column.bytes.byteLength
            }
        }));
        const size = columns.reduce((total, column) => total + column.bytes.byteLength, 0);
        return {
            id,
            path: null,
            mode: 'inline',
            size,
            bindings,
            inlinePayload: { columns },
            release: async () => {}
        };
    }

    private async writeColumnsToFile(filePath: string, columns: SharedFrameColumn[]): Promise<{
        bindings: PluginFrameColumnBinding[];
        totalBytes: number;
    }> {
        const blocks = columns.map((column) => ({
            column,
            view: toBufferView(column.data)
        }));
        const totalBytes = blocks.reduce((total, block) => total + block.view.byteLength, 0);
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

        return { bindings, totalBytes };
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
            logger.warn({ err: error, storageRoot }, '@shared-memory-bridge: failed to list stale frame mmap files');
            return;
        }

        await Promise.all(entries
            .filter((entry) => entry.startsWith(FRAME_MMAP_FILE_PREFIX))
            .map((entry) => safeRemovePath(path.join(storageRoot, entry)).catch((error: unknown) => {
                logger.warn(
                    { err: error, filePath: path.join(storageRoot, entry) },
                    '@shared-memory-bridge: failed to remove stale frame mmap file'
                );
            })));
    }
}
