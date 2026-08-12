import { Router } from 'express';
import {
    SYS_BUCKETS,
    USER_FILES_BASE_PATH,
    readFileMetadata,
    userFilePath
} from '@shared/infrastructure/services/FilesystemStorageService';
import fs from 'node:fs/promises';
import type { SysBucket } from '@shared/infrastructure/services/FilesystemStorageService';

const SERVABLE_BUCKETS = new Set<string>(Object.values(SYS_BUCKETS));

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

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
