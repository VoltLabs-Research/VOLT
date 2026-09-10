import fs from 'node:fs/promises';
import path from 'node:path';

export const SYS_BUCKETS = {
    AVATARS: 'volt-avatars'
} as const;

export type SysBucket = typeof SYS_BUCKETS[keyof typeof SYS_BUCKETS];

export const USER_FILES_BASE_PATH = '/api/files';

const STORAGE_ROOT = process.env.USER_FILES_ROOT
    ?? path.join(process.env.SERVER_DATA_DIR ?? path.join(process.cwd(), 'storage'), 'user-files');

const PUBLIC_ORIGIN = (process.env.SERVER_ENDPOINT ?? 'http://localhost:8100').replace(/\/+$/, '');

interface StoredFileMetadata {
    contentType: string;
}

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

class FilesystemStorageService {
    async upload(
        bucket: SysBucket,
        objectName: string,
        body: Buffer,
        metadata: Record<string, string> = {}
    ): Promise<void> {
        const destination = resolveFilePath(bucket, objectName);
        await fs.mkdir(path.dirname(destination), { recursive: true });

        const temporary = `${destination}.partial`;
        await fs.writeFile(temporary, body);
        await fs.rename(temporary, destination);

        const stored: StoredFileMetadata = {
            contentType: metadata['Content-Type'] ?? metadata['content-type'] ?? 'application/octet-stream'
        };
        await fs.writeFile(`${destination}.meta.json`, JSON.stringify(stored));
    }

    getPublicURL(bucket: SysBucket, objectName: string): string {
        return `${PUBLIC_ORIGIN}${USER_FILES_BASE_PATH}/${bucket}/${objectName}`;
    }
}

export default new FilesystemStorageService();
