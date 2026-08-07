import { Router } from 'express';
import {
    SYS_BUCKETS,
    USER_FILES_BASE_PATH,
    readFileMetadata,
    userFilePath
} from '@shared/infrastructure/services/FilesystemStorageService';
import fs from 'node:fs/promises';
import type { SysBucket } from '@shared/infrastructure/services/FilesystemStorageService';

/** Only the control plane's own buckets are reachable; anything else is a 404. */
const SERVABLE_BUCKETS = new Set<string>(Object.values(SYS_BUCKETS));

/**
 * A year, because every key carries what makes it unique.
 *
 * An avatar's name embeds the upload timestamp and a chat file's is a uuid, so a
 * given URL's bytes never change — a new upload produces a new URL.
 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Serves avatars and chat attachments.
 *
 * Deliberately unauthenticated, and that is forced rather than chosen: the client
 * renders these through `<img src>` and `<a href>`, which send no Authorization
 * header. Requiring a session would blank every avatar in the product. The object
 * store this replaced made the same two buckets world-readable, so this preserves
 * the reachability that already existed instead of quietly widening or narrowing
 * it. Signed URLs are the way to close it, and that is a product change.
 */
export const createUserFilesRouter = (): Router => {
    const router = Router();

    router.get(`${USER_FILES_BASE_PATH}/:bucket/*objectName`, async (request, response) => {
        const bucket = request.params.bucket;
        const objectName = Array.isArray(request.params.objectName)
            ? request.params.objectName.join('/')
            : String(request.params.objectName ?? '');

        if (!SERVABLE_BUCKETS.has(bucket)) {
            response.sendStatus(404);
            return;
        }

        let handle;
        try {
            /* Opened before anything is written to the response, so a missing file
               is a clean 404 rather than a stream error mid-body. */
            handle = await fs.open(userFilePath(bucket as SysBucket, objectName), 'r');
        } catch {
            response.sendStatus(404);
            return;
        }

        const metadata = await readFileMetadata(bucket as SysBucket, objectName);
        response.setHeader('content-type', metadata?.contentType ?? 'application/octet-stream');
        response.setHeader('cache-control', CACHE_CONTROL);

        handle.createReadStream().pipe(response);
    });

    return router;
};
