import { errorMessage } from '@shared/application/utilities/error-message';
import { getConfig } from '@core/config/daemon';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getFilesystemObjectStore } from '@shared/infrastructure/storage/FilesystemObjectStore';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import type { DaemonConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import type { ClusterObjectStore, LocalClusterObjectStoreGateway } from '@shared/contracts/types/cluster-object-store';
import { isObjectNotFoundError } from '@shared/contracts/types/cluster-object-store';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
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

interface ArchiverModule {
    ZipArchive: new (options?: archiver.ArchiverOptions) => archiver.Archiver;
}

/*
 * Extensions whose bytes are already compressed. Deflating them again is close to
 * pure CPU: the archive barely shrinks, and on an export whose bulk is zstd GLBs it
 * is what puts seconds between the request and the first byte. Stored entries are
 * ordinary zip entries, so readers are unaffected.
 */
const PRECOMPRESSED_EXTENSIONS = new Set([
    '.zst', '.zip', '.gz', '.tgz', '.bz2', '.xz', '.br', '.7z',
    '.png', '.jpg', '.jpeg', '.webp', '.avif', '.parquet'
]);

const isPrecompressedEntryName = (name: string): boolean => {
    const dot = name.lastIndexOf('.');
    return dot !== -1 && PRECOMPRESSED_EXTENSIONS.has(name.slice(dot).toLowerCase());
};

const createZipArchive = (options: archiver.ArchiverOptions): archiver.Archiver => {
    // archiver@8 dropped the callable `archiver(format, options)` factory for named archive
    // classes, but @types/archiver@7 still declares the v7 shape, so the module has to be re-typed.
    const { ZipArchive } = archiver as unknown as ArchiverModule;
    return new ZipArchive(options);
};

@CommandGroup('object-store')
export class ObjectStoreArchiveCommands {
    constructor(
        private readonly config: DaemonConfig,
        private readonly objectStore: ClusterObjectStore,
        private readonly localObjectStore: LocalClusterObjectStoreGateway
    ) {}

    @Command('archive.create')
    async create(payload: ArchiveCreatePayload): Promise<ArchiveCreateResult> {
        if (!payload.output.objectKey) {
            throw new Error('object-store.archive.create requires output.objectKey');
        }
        if (payload.entries.length === 0) {
            throw new Error('object-store.archive.create requires at least one entry');
        }

        const outputBucket = payload.output.bucket || ObjectBucketName.Trajectories;

        return withNativeProcessingTempDir('object-store-archive', async (tempDirectory) => {
            const archivePath = path.join(tempDirectory, 'archive.zip');
            const output = createWriteStream(archivePath);
            const archive = createZipArchive({ zlib: { level: 5 } });

            archive.on('warning', (error) => {
                logger.warn(`@object-store-archive: ${errorMessage(error)}`);
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
            await this.localObjectStore.putObjectStream({
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

        /* Inline entries are JSON/CSV text, which is exactly what deflate is for. */
        if (entry.type === 'inline') {
            archive.append(Buffer.from(entry.content, entry.encoding || 'utf8'), { name });
            return;
        }

        const store = isPrecompressedEntryName(name);

        try {
            const response = await this.objectStore.getStream(
                entry.ownerClusterId || this.config.teamClusterId,
                entry.bucket,
                entry.objectKey,
                { skipMetadata: true }
            );
            archive.append(response.stream, {
                name,
                store
            });
        } catch (error) {
            if (entry.optional && isObjectNotFoundError(error)) {
                logger.debug(`@object-store-archive: skipped missing optional object ${entry.bucket}/${entry.objectKey}`);
                return;
            }

            throw error;
        }
    }
}

export const getObjectStoreArchiveCommands = commandGroupFactory(ObjectStoreArchiveCommands, () => new ObjectStoreArchiveCommands(getConfig(), getObjectStore(), getFilesystemObjectStore()));
