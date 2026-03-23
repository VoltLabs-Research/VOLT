import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const ensureDaemonTestNodePath = async (): Promise<void> => {
    const stubRoot = path.join(os.tmpdir(), 'daemon-client-stub');
    const stubModuleDirectory = path.join(stubRoot, '@voltstack', 'daemon-cluster-client');
    await fs.mkdir(stubModuleDirectory, { recursive: true });
    await fs.writeFile(
        path.join(stubModuleDirectory, 'index.js'),
        [
            'exports.DaemonSocketEvent = {',
            "  RuntimeLifecycle: 'runtime-lifecycle',",
            "  RuntimeProgress: 'runtime-progress'",
            '};'
        ].join('\n'),
        'utf8'
    );

    process.env.NODE_PATH = [
        stubRoot,
        path.resolve(process.cwd(), '../Volt/server/node_modules'),
        process.env.NODE_PATH || ''
    ].filter(Boolean).join(path.delimiter);
    (Module as any)._initPaths();
};

const buildService = async (responses: Array<{
    objects: Array<{ name?: string; prefix?: string; size?: number; etag?: string; lastModified?: Date; }>;
    isTruncated: boolean;
    nextContinuationToken: string;
}>) => {
    await ensureDaemonTestNodePath();
    const { MinioService } = await import('./MinioService');
    const calls: Array<{ maxKeys: number; continuationToken: string; startAfter: string; }> = [];
    const fakeClient = {
        async listObjectsV2Query(
            _bucket: string,
            _prefix: string,
            continuationToken: string,
            _delimiter: string,
            maxKeys: number,
            startAfter: string
        ) {
            calls.push({
                maxKeys,
                continuationToken,
                startAfter
            });

            const nextResponse = responses.shift();
            if (!nextResponse) {
                return {
                    objects: [],
                    isTruncated: false,
                    nextContinuationToken: ''
                };
            }

            return nextResponse;
        },
        async removeObjects(): Promise<void> {}
    };

    const service = Object.create(MinioService.prototype) as MinioService;
    Reflect.set(service as object, 'client', fakeClient);

    return {
        service,
        calls
    };
};

test('MinioService.listObjects limits upstream MinIO page size instead of parsing 1000 keys at once', async () => {
    const { service, calls } = await buildService([
        {
            objects: Array.from({ length: 20 }, (_, index) => ({
                name: `prefix/object-${index}`
            })),
            isTruncated: true,
            nextContinuationToken: 'next-page'
        }
    ]);

    const keys = await service.listObjects('volt-dumps', 'prefix/', 20);

    assert.equal(keys.length, 20);
    assert.deepEqual(calls, [{
        maxKeys: 20,
        continuationToken: '',
        startAfter: ''
    }]);
});

test('MinioService.listObjectsPage stitches multiple safe MinIO pages for larger logical limits', async () => {
    const { service, calls } = await buildService([
        {
            objects: Array.from({ length: 200 }, (_, index) => ({
                name: `prefix/object-${index}`
            })),
            isTruncated: true,
            nextContinuationToken: 'page-2'
        },
        {
            objects: Array.from({ length: 51 }, (_, index) => ({
                name: `prefix/object-${200 + index}`
            })),
            isTruncated: false,
            nextContinuationToken: ''
        }
    ]);

    const page = await service.listObjectsPage({
        bucket: 'volt-models',
        prefix: 'prefix/',
        cursor: undefined,
        limit: 250
    });

    assert.equal(page.keys.length, 250);
    assert.equal(page.nextCursor, 'prefix/object-249');
    assert.deepEqual(calls, [
        {
            maxKeys: 200,
            continuationToken: '',
            startAfter: ''
        },
        {
            maxKeys: 51,
            continuationToken: 'page-2',
            startAfter: ''
        }
    ]);
});
