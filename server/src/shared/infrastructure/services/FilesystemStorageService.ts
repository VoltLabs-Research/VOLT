import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * The bucket the control plane owns.
 *
 * It holds files a browser fetches by plain URL, so it is served without
 * credentials — see the router in `user-files-router.ts` for why that is a
 * constraint rather than a choice.
 */
export const SYS_BUCKETS = {
    AVATARS: 'volt-avatars'
} as const;

export type SysBucket = typeof SYS_BUCKETS[keyof typeof SYS_BUCKETS];

/** Where the route that serves these files is mounted. */
export const USER_FILES_BASE_PATH = '/api/files';

const STORAGE_ROOT = process.env.USER_FILES_ROOT
    ?? path.join(process.env.SERVER_DATA_DIR ?? path.join(process.cwd(), 'storage'), 'user-files');

const PUBLIC_ORIGIN = (process.env.SERVER_ENDPOINT ?? 'http://localhost:8100').replace(/\/+$/, '');

interface StoredFileMetadata {
    contentType: string;
}

/**
 * Resolves a bucket and key to a path, refusing anything that escapes the bucket.
 *
 * Keys are built from user input — an original filename's extension, a uuid — so
 * containment is checked after resolution rather than by inspecting the raw key,
 * which would miss `..` however it is encoded.
 */
const resolveFilePath = (bucket: string, objectName: string): string => {
    const bucketRoot = path.join(STORAGE_ROOT, bucket);
    const resolved = path.resolve(bucketRoot, objectName);

    if (!resolved.startsWith(`${bucketRoot}${path.sep}`)) {
        throw new Error(`Object key escapes its bucket: ${objectName}`);
    }

    return resolved;
};

export const userFilePath = resolveFilePath;

export const readFileMetadata = async (bucket: string, objectName: string): Promise<StoredFileMetadata | null> => {
    try {
        const raw = await fs.readFile(`${resolveFilePath(bucket, objectName)}.meta.json`, 'utf8');
        return JSON.parse(raw) as StoredFileMetadata;
    } catch {
        return null;
    }
};

/**
 * Avatars, on the local filesystem.
 *
 * Only the two operations the callers actually use are here. The object store
 * this replaced also exposed reads, deletes, existence checks and prefix deletes,
 * none of which had a single call site — reproducing them would have carried dead
 * surface into the replacement.
 */
class FilesystemStorageService {
    async upload(
        bucket: SysBucket,
        objectName: string,
        body: Buffer,
        metadata: Record<string, string> = {}
    ): Promise<void> {
        const destination = resolveFilePath(bucket, objectName);
        await fs.mkdir(path.dirname(destination), { recursive: true });

        /*
         * Written to a temporary name and renamed, so the route can never serve a
         * half-written avatar to a browser that requested it mid-upload.
         */
        const temporary = `${destination}.partial`;
        await fs.writeFile(temporary, body);
        await fs.rename(temporary, destination);

        const stored: StoredFileMetadata = {
            contentType: metadata['Content-Type'] ?? metadata['content-type'] ?? 'application/octet-stream'
        };
        await fs.writeFile(`${destination}.meta.json`, JSON.stringify(stored));
    }

    /**
     * The absolute URL a browser fetches the file from.
     *
     * Absolute rather than relative because the client is served from a different
     * origin than the API, so a path alone would resolve against the client.
     */
    getPublicURL(bucket: SysBucket, objectName: string): string {
        return `${PUBLIC_ORIGIN}${USER_FILES_BASE_PATH}/${bucket}/${objectName}`;
    }
}

export default new FilesystemStorageService();
