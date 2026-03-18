import assert from 'node:assert/strict';
import test from 'node:test';
import { encode } from '@msgpack/msgpack';
import { TrajectoryPluginParserService } from './TrajectoryPluginParserService';

import type { MinioService } from '@/modules/platform/services';

const createAsyncStream = (...messages: unknown[]): AsyncIterable<Uint8Array> => {
    return {
        async *[Symbol.asyncIterator]() {
            for (const message of messages) {
                yield encode(message);
            }
        }
    };
};

test('discoverPerAtomPropertyNames resolves the requested timestep instead of the first exposure dump', async () => {
    const requestedKeys: string[] = [];
    const minioService = {
        getObjectStream: async (_bucketName: string, objectKey: string) => {
            requestedKeys.push(objectKey);

            if (objectKey.endsWith('timestep-10.msgpack')) {
                return createAsyncStream({
                    'per-atom-properties': [
                        { id: '1', charge: 1.25, spin: -1 }
                    ]
                });
            }

            throw new Error('missing object');
        },
        listObjects: async () => {
            return [
                'plugins/trajectory-traj-1/analysis-analysis-1/exposure-a/timestep-0.msgpack'
            ];
        }
    } as unknown as MinioService;

    const service = new TrajectoryPluginParserService(minioService);

    const result = await service.discoverPerAtomPropertyNames({
        trajectoryId: 'traj-1',
        analysisId: 'analysis-1',
        exposureId: 'exposure-a',
        timestep: 10
    });

    assert.deepEqual(result, ['charge', 'spin']);
    assert.deepEqual(requestedKeys, [
        'plugins/trajectory-traj-1/analysis-analysis-1/exposure-a/timestep-10.msgpack'
    ]);
});
