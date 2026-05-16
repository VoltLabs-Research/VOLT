import { Command, CommandGroup } from '@/core/commands/decorators';
import type { DaemonConfig } from '@/core/config';
import { logger } from '@/core/logger';
import type { ClusterObjectStore, LocalClusterObjectStoreGateway } from '@/core/storage/contracts/cluster-object-store';
import { isObjectNotFoundError } from '@/core/storage/contracts/cluster-object-store';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import archiver = require('archiver');
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { finished } from 'node:stream/promises';

interface ArchiveObjectEntryPayload {
    type: 'object';
    name: string;
    bucket: string;
    objectKey: string;
    ownerClusterId?: string;
    optional?: boolean;
}

interface ArchiveInlineEntryPayload {
    type: 'inline';
    name: string;
    content: string;
    encoding?: BufferEncoding;
}

type ArchiveEntryPayload = ArchiveObjectEntryPayload | ArchiveInlineEntryPayload;

interface ArchiveCreatePayload {
    output: {
        bucket?: string;
        objectKey: string;
    };
    entries: ArchiveEntryPayload[];
}

interface ArchiveCreateResult {
    bucket: string;
    objectKey: string;
    contentLength: number;
}

const normalizeZipEntryName = (value: string): string => {
    const normalized = path.posix.normalize(value.replace(/\\/g, '/')).replace(/^\/+/, '');
    if (
        normalized.length === 0
        || normalized === '.'
        || normalized.startsWith('../')
        || normalized.includes('/../')
    ) {
        throw new Error(`Invalid archive entry path: ${value}`);
    }

    return normalized;
};

interface ArchiverRuntime {
    ZipArchive?: new (options?: archiver.ArchiverOptions) => archiver.Archiver;
}

const createZipArchive = (options: archiver.ArchiverOptions): archiver.Archiver => {
    const runtime = archiver as unknown as ArchiverRuntime;
    return new runtime.ZipArchive!(options);
};

@CommandGroup('object-store')
export class ObjectStoreArchiveCommands {
    constructor(
        private readonly config: DaemonConfig,
        private readonly objectStore: ClusterObjectStore,
        private readonly minioService: LocalClusterObjectStoreGateway
    ) {}

    @Command('archive.create')
    async create(payload: ArchiveCreatePayload): Promise<ArchiveCreateResult> {
        if (!payload?.output?.objectKey) {
            throw new Error('object-store.archive.create requires output.objectKey');
        }
        if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
            throw new Error('object-store.archive.create requires at least one entry');
        }

        const outputBucket = payload.output.bucket || ObjectBucketName.Trajectories;

        return withNativeProcessingTempDir('object-store-archive', async (tempDirectory) => {
            const archivePath = path.join(tempDirectory, 'archive.zip');
            const output = createWriteStream(archivePath);
            const archive = createZipArchive({ zlib: { level: 5 } });

            archive.on('warning', (error) => {
                logger.warn(`@object-store-archive: ${error instanceof Error ? error.message : String(error)}`);
            });
            archive.on('error', (error) => {
                output.destroy(error);
            });
            archive.pipe(output);

            for (const entry of payload.entries) {
                await this.appendEntry(archive, entry);
            }

            await archive.finalize();
            await finished(output);

            const stat = await fs.stat(archivePath);
            await this.minioService.putObjectStream({
                bucket: outputBucket,
                objectKey: payload.output.objectKey,
                stream: createReadStream(archivePath),
                size: stat.size,
                metadata: {
                    'Content-Type': 'application/zip'
                }
            });

            return {
                bucket: outputBucket,
                objectKey: payload.output.objectKey,
                contentLength: stat.size
            };
        });
    }

    private async appendEntry(archive: archiver.Archiver, entry: ArchiveEntryPayload): Promise<void> {
        const name = normalizeZipEntryName(entry.name);

        if (entry.type === 'inline') {
            archive.append(Buffer.from(entry.content, entry.encoding || 'utf8'), { name });
            return;
        }

        try {
            const response = await this.objectStore.getStream(
                entry.ownerClusterId || this.config.teamClusterId,
                entry.bucket,
                entry.objectKey,
                { skipMetadata: true }
            );
            archive.append(response.stream, { name });
        } catch (error) {
            if (entry.optional && isObjectNotFoundError(error)) {
                logger.debug(`@object-store-archive: skipped missing optional object ${entry.bucket}/${entry.objectKey}`);
                return;
            }

            throw error;
        }
    }
}
