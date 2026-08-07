import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { finished, pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DaemonConfig } from '@core/config/daemon';
import type { Readable } from 'node:stream';
import type {
    ClusterObjectListEntry,
    ClusterObjectListResponse,
    LocalClusterObjectComposeInput,
    LocalClusterObjectListRequest,
    LocalClusterObjectStat,
    LocalClusterObjectStoreGateway,
    ScopedClusterObjectPutInput,
    ScopedClusterObjectPutStreamInput
} from '@shared/contracts/types/cluster-object-store';

/** The two metadata keys the object gateway serves natively rather than as custom headers. */
const NATIVE_METADATA_KEYS = new Set(['content-type', 'content-encoding']);

/**
 * Prefix S3 gives custom metadata on the way out.
 *
 * The gateway's header writer re-emits exactly the keys carrying it, so a store
 * that returned custom metadata unprefixed would silently stop forwarding it.
 */
const CUSTOM_METADATA_PREFIX = 'x-amz-meta-';

interface StoredMetadata {
    etag: string;
    metaData: Record<string, string>;
}

/**
 * Splits a caller's metadata into what S3 returns natively and what it prefixes.
 *
 * Emulating the round trip rather than storing the map verbatim is what keeps
 * `writeObjectHeaders` forwarding custom metadata: it looks for the prefix.
 */
const toStoredMetadata = (metadata: Record<string, string> | undefined): Record<string, string> => {
    const stored: Record<string, string> = {};

    for (const [key, value] of Object.entries(metadata ?? {})) {
        const lowered = key.toLowerCase();
        stored[NATIVE_METADATA_KEYS.has(lowered) ? lowered : `${CUSTOM_METADATA_PREFIX}${lowered}`] = value;
    }

    return stored;
};

/**
 * The cluster object store, on the local filesystem.
 *
 * Objects are files and their keys are paths, so a key's `/` separators become
 * directories. Metadata lives in a parallel tree rather than beside the object:
 * a sidecar named after the object would be indistinguishable from a real object
 * whose key happened to end the same way, and listing would return it.
 *
 * Every write lands in a temporary file and is renamed into place. A partially
 * written object must never be readable — the GLB path streams these to browsers
 * while other jobs are still uploading siblings, and `rename` within a filesystem
 * is the atomic swap that guarantees it.
 */
export class FilesystemObjectStore implements LocalClusterObjectStoreGateway {
    private readonly objectsRoot: string;
    private readonly metadataRoot: string;
    private readonly bucketPrefix: string;

    constructor(private readonly config: DaemonConfig) {
        this.objectsRoot = path.join(config.objectStoreRoot, 'objects');
        this.metadataRoot = path.join(config.objectStoreRoot, 'metadata');
        this.bucketPrefix = config.bucketPrefix ?? '';
    }

    /** An empty prefix makes `startsWith` trivially true, so unprefixed buckets pass through. */
    private resolveBucket(bucket: string): string {
        return bucket.startsWith(this.bucketPrefix) ? bucket : `${this.bucketPrefix}${bucket}`;
    }

    /**
     * Maps a bucket and key to a path, refusing anything that escapes the bucket.
     *
     * Keys arrive from callers and, on the upload route, from the wire. Resolving
     * first and then checking containment catches `..` however it is spelled or
     * encoded, which a substring check on the raw key would not.
     */
    private resolvePath(root: string, bucket: string, objectKey: string): string {
        const bucketRoot = path.join(root, this.resolveBucket(bucket));
        const resolved = path.resolve(bucketRoot, objectKey);

        if (resolved !== bucketRoot && !resolved.startsWith(`${bucketRoot}${path.sep}`)) {
            throw new Error(`Object key escapes its bucket: ${objectKey}`);
        }

        return resolved;
    }

    private objectPath(bucket: string, objectKey: string): string {
        return this.resolvePath(this.objectsRoot, bucket, objectKey);
    }

    private metadataPath(bucket: string, objectKey: string): string {
        return `${this.resolvePath(this.metadataRoot, bucket, objectKey)}.json`;
    }

    listBuckets(): string[] {
        return [...this.config.allowedBuckets];
    }

    async ensureBuckets(): Promise<void> {
        for (const bucket of this.listBuckets()) {
            const resolvedBucket = this.resolveBucket(bucket);
            await fs.mkdir(path.join(this.objectsRoot, resolvedBucket), { recursive: true });
            await fs.mkdir(path.join(this.metadataRoot, resolvedBucket), { recursive: true });
        }

        logger.info(`@object-store: ${this.listBuckets().length} buckets ready under ${this.config.objectStoreRoot}`);
    }

    async statObject(bucket: string, objectKey: string): Promise<LocalClusterObjectStat> {
        const stats = await fs.stat(this.objectPath(bucket, objectKey));
        const stored = await this.readMetadata(bucket, objectKey);

        return {
            size: stats.size,
            metaData: stored?.metaData ?? {},
            /*
             * Falling back to size and mtime rather than hashing on read: the
             * caches downstream only compare signatures for equality, and hashing
             * a multi-hundred-megabyte dump on every head would dominate the read.
             */
            etag: stored?.etag ?? `${stats.size}-${stats.mtimeMs}`,
            lastModified: stats.mtime
        };
    }

    /**
     * Opens the object first, so a missing one rejects here rather than later.
     *
     * `createReadStream` on a path is lazy: it resolves happily and only emits
     * `error` once someone reads. Callers were written against a client that
     * rejected at call time, so they `catch` around the await and have no listener
     * on the stream — a deferred `error` there is unhandled and takes the process
     * down. Opening the handle moves the failure back to where it is caught.
     */
    private async openStream(
        bucket: string,
        objectKey: string,
        range?: { start: number; end: number }
    ): Promise<Readable> {
        const handle = await fs.open(this.objectPath(bucket, objectKey), 'r');
        return handle.createReadStream(range);
    }

    getObjectStream(bucket: string, objectKey: string): Promise<Readable> {
        return this.openStream(bucket, objectKey);
    }

    getObjectRangeStream(bucket: string, objectKey: string, offset: number, length: number): Promise<Readable> {
        /* `end` is inclusive, so the last byte of the window is offset + length - 1. */
        return this.openStream(bucket, objectKey, {
            start: offset,
            end: offset + length - 1
        });
    }

    async putObject(input: ScopedClusterObjectPutInput): Promise<void> {
        await this.write(input.bucket, input.objectKey, input.metadata, async (destination) => {
            await fs.writeFile(destination, input.body);
            return createHash('md5').update(input.body).digest('hex');
        });
    }

    async putObjectStream(input: ScopedClusterObjectPutStreamInput): Promise<void> {
        await this.write(input.bucket, input.objectKey, input.metadata, async (destination) => {
            const hash = createHash('md5');
            /* Hashed while the bytes already flow through, so the etag costs no extra pass. */
            input.stream.on('data', (chunk: Buffer) => hash.update(chunk));
            await pipeline(input.stream, createWriteStream(destination));
            return hash.digest('hex');
        });
    }

    async composeObject(input: LocalClusterObjectComposeInput): Promise<void> {
        await this.write(input.bucket, input.objectKey, input.metadata, async (destination) => {
            const hash = createHash('md5');
            const target = createWriteStream(destination);

            try {
                for (const sourceObjectKey of input.sourceObjectKeys) {
                    const source = createReadStream(this.objectPath(input.bucket, sourceObjectKey));
                    source.on('data', (chunk: Buffer) => hash.update(chunk));
                    /* `end: false` keeps the target open so the next source appends. */
                    await pipeline(source, target, { end: false });
                }
            } catch (error) {
                target.destroy();
                throw error;
            }

            target.end();
            await finished(target);

            return hash.digest('hex');
        });
    }

    /**
     * Writes an object and its metadata, publishing both by rename.
     *
     * The object is renamed before its metadata, so the worst a concurrent reader
     * can observe is a complete object whose metadata has not landed yet — which
     * `statObject` already handles by falling back to size and mtime. The reverse
     * order would expose metadata for bytes that do not exist.
     */
    private async write(
        bucket: string,
        objectKey: string,
        metadata: Record<string, string> | undefined,
        writeBytes: (destination: string) => Promise<string>
    ): Promise<void> {
        const finalPath = this.objectPath(bucket, objectKey);
        const metadataFinalPath = this.metadataPath(bucket, objectKey);

        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        await fs.mkdir(path.dirname(metadataFinalPath), { recursive: true });

        const temporaryPath = `${finalPath}.${randomUUID()}.partial`;

        try {
            const etag = await writeBytes(temporaryPath);
            await fs.rename(temporaryPath, finalPath);

            const stored: StoredMetadata = {
                etag,
                metaData: toStoredMetadata(metadata)
            };
            const metadataTemporaryPath = `${metadataFinalPath}.${randomUUID()}.partial`;
            await fs.writeFile(metadataTemporaryPath, JSON.stringify(stored));
            await fs.rename(metadataTemporaryPath, metadataFinalPath);
        } catch (error) {
            await fs.rm(temporaryPath, { force: true });
            throw error;
        }
    }

    private async readMetadata(bucket: string, objectKey: string): Promise<StoredMetadata | null> {
        try {
            return JSON.parse(await fs.readFile(this.metadataPath(bucket, objectKey), 'utf8')) as StoredMetadata;
        } catch {
            /* An object written before its metadata landed, or by an older build. */
            return null;
        }
    }

    async removeObject(bucket: string, objectKey: string): Promise<void> {
        await fs.rm(this.objectPath(bucket, objectKey), { force: true });
        await fs.rm(this.metadataPath(bucket, objectKey), { force: true });
    }

    /**
     * Every key under `prefix`, in the lexicographic order S3 guarantees.
     *
     * Directory order from the filesystem is unspecified, so the walk collects and
     * sorts. Callers page through this with a cursor, and a cursor is meaningless
     * against an order that can change between calls.
     */
    private async collectKeys(bucket: string, prefix: string): Promise<string[]> {
        const bucketRoot = path.join(this.objectsRoot, this.resolveBucket(bucket));
        const keys: string[] = [];

        const walk = async (directory: string): Promise<void> => {
            let entries;
            try {
                entries = await fs.readdir(directory, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                const absolute = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    await walk(absolute);
                    continue;
                }

                /* A crashed write leaves one behind; it is not an object. */
                if (entry.name.endsWith('.partial')) {
                    continue;
                }

                const key = path.relative(bucketRoot, absolute).split(path.sep).join('/');
                if (key.startsWith(prefix)) {
                    keys.push(key);
                }
            }
        };

        await walk(bucketRoot);
        return keys.sort();
    }

    async listObjects(bucket: string, prefix: string): Promise<string[]> {
        return this.collectKeys(bucket, prefix);
    }

    async listObjectsPage(input: LocalClusterObjectListRequest): Promise<ClusterObjectListResponse> {
        const cursor = input.cursor ?? '';
        const candidates = (await this.collectKeys(input.bucket, input.prefix))
            .filter((key) => key > cursor);

        /* One key past the page proves another page exists and names its cursor. */
        const page = candidates.slice(0, input.limit);
        const objects: ClusterObjectListEntry[] = await Promise.all(page.map(async (key) => {
            const stats = await fs.stat(this.objectPath(input.bucket, key));
            return {
                key,
                contentLength: stats.size,
                lastModified: stats.mtime
            };
        }));

        return {
            keys: page,
            objects,
            nextCursor: candidates.length > input.limit ? page[page.length - 1] : undefined
        };
    }

    async deleteByPrefix(bucket: string, prefix: string): Promise<number> {
        const keys = await this.collectKeys(bucket, prefix);

        for (const key of keys) {
            await this.removeObject(bucket, key);
        }

        return keys.length;
    }
}

export const getFilesystemObjectStore = singleton(
    (): FilesystemObjectStore => new FilesystemObjectStore(getConfig())
);
