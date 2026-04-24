import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PluginFrameColumnBinding } from '@/modules/plugin/contracts/plugin-batch';
import { safeRemovePath } from '@/support/fs/safe-remove-path';

const DEV_SHM_ROOT = '/dev/shm';
const SHM_FILE_PREFIX = 'volt-plugin-';

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
    mode: 'shm' | 'inline';
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

const resolveDevShmAvailability = async (): Promise<boolean> => {
    if (process.platform !== 'linux') {
        return false;
    }

    try {
        const stat = await fs.stat(DEV_SHM_ROOT);
        return stat.isDirectory();
    } catch {
        return false;
    }
};

const toBufferView = (view: ArrayBufferView): Buffer => {
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
};

@Service('sharedMemoryBridge')
export class SharedMemoryBridge {
    private shmAvailablePromise: Promise<boolean> | null = null;

    async publishFrame(input: SharedFramePublishInput): Promise<SharedFrameHandle> {
        if (!input.columns.length) {
            return this.buildInlineHandle(randomUUID(), input);
        }

        const shmAvailable = await this.isShmAvailable();
        if (!shmAvailable) {
            return this.buildInlineHandle(randomUUID(), input);
        }

        const id = randomUUID();
        const filename = `${SHM_FILE_PREFIX}${id}`;
        const filePath = path.join(DEV_SHM_ROOT, filename);

        try {
            const { buffer, bindings, totalBytes } = this.layoutColumns(input.columns);
            await fs.writeFile(filePath, buffer, { mode: 0o600 });

            const handle: SharedFrameHandle = {
                id,
                path: filePath,
                mode: 'shm',
                size: totalBytes,
                bindings,
                release: async () => {
                    await safeRemovePath(filePath);
                }
            };
            return handle;
        } catch (error: unknown) {
            logger.warn({ err: error }, '@shared-memory-bridge: falling back to inline payload');
            return this.buildInlineHandle(id, input);
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

    private layoutColumns(columns: SharedFrameColumn[]): {
        buffer: Buffer;
        bindings: PluginFrameColumnBinding[];
        totalBytes: number;
    } {
        const blocks = columns.map((column) => ({
            column,
            view: toBufferView(column.data)
        }));
        const totalBytes = blocks.reduce((total, block) => total + block.view.byteLength, 0);
        const buffer = Buffer.allocUnsafe(totalBytes);
        const bindings: PluginFrameColumnBinding[] = [];
        let cursor = 0;

        for (const block of blocks) {
            block.view.copy(buffer, cursor);
            bindings.push({
                name: block.column.name,
                dtype: block.column.dtype,
                shape: block.column.shape,
                binding: {
                    kind: 'shm',
                    offset: cursor,
                    length: block.view.byteLength,
                    dtype: block.column.dtype
                }
            });
            cursor += block.view.byteLength;
        }

        return { buffer, bindings, totalBytes };
    }

    private isShmAvailable(): Promise<boolean> {
        if (!this.shmAvailablePromise) {
            this.shmAvailablePromise = resolveDevShmAvailability();
        }
        return this.shmAvailablePromise;
    }
}
