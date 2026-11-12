import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';
import spatialAssembler from '@voltstack/spatial-assembler';
import { getFilesystemObjectStore, type FilesystemObjectStore } from '@shared/storage/FilesystemObjectStore';
import { decompressModel, encodeEmptyModel, MODEL_BUCKET, toModelFormat } from '@shared/storage/model-objects';
import type { TrajectoryFrameLookupInput } from '@shared/contracts/types/trajectory-frame-store';
import { LegacyModelMigration } from '@modules/trajectory/services/glb/LegacyModelMigration';

const CLUSTER_ID = 'cluster-test';

let objectStoreRoot = '';
let objectStore: FilesystemObjectStore;

// y = 5.125 sits exactly between two grid points, so it moves by a full half step; float32 adds
// a little on top of that.
const FLOAT32_NOISE = 1e-6;

const frame = (timestep: number) => ({
    positions: new Float32Array([timestep, 0, 0, 1.5, 2.25, 3, -4, 5.125, 6]),
    types: new Uint16Array([1, 2, 3])
});

const frameSource = () => {
    const reads: TrajectoryFrameLookupInput[] = [];
    return {
        reads,
        readFrame: async (input: TrajectoryFrameLookupInput) => {
            reads.push(input);
            await new Promise((resolve) => setTimeout(resolve, 10));
            return frame(input.timestep);
        }
    };
};

const putLegacy = (objectKey: string) => objectStore.putObject({
    bucket: MODEL_BUCKET,
    objectKey,
    body: Buffer.from('float32 glTF, zstd-compressed'),
    metadata: {
        'Content-Type': 'model/gltf-binary',
        'Content-Encoding': 'zstd'
    }
});

const stored = async (prefix: string) => (await objectStore.listObjects(MODEL_BUCKET, prefix)).sort();

before(async () => {
    objectStoreRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'volt-legacy-models-'));
    process.env.OBJECT_STORE_ROOT = objectStoreRoot;
    process.env.TEAM_CLUSTER_ID ??= CLUSTER_ID;
    process.env.TEAM_CLUSTER_DAEMON_PASSWORD ??= 'test';
    process.env.VOLT_CLOUD_URL ??= 'http://localhost';
    objectStore = getFilesystemObjectStore();
    await objectStore.ensureBuckets();
});

after(() => {
    fs.rmSync(objectStoreRoot, {
        recursive: true,
        force: true
    });
});

test('a legacy frame is rebuilt from its frame data, in frame order, and replaces the zstd object', async () => {
    const source = frameSource();
    const migration = new LegacyModelMigration(objectStore, source, CLUSTER_ID);
    await putLegacy('trajectory-a/timestep-5.glb.zst');

    assert.equal(await migration.convertMissing(MODEL_BUCKET, 'trajectory-a/timestep-5.glb.gz'), true);

    assert.deepEqual(source.reads, [{
        trajectoryId: 'a',
        timestep: 5,
        ownerClusterId: CLUSTER_ID
    }]);
    assert.deepEqual(await stored('trajectory-a/'), ['trajectory-a/timestep-5.glb.gz']);
    const stat = await objectStore.statObject(MODEL_BUCKET, 'trajectory-a/timestep-5.glb.gz');
    assert.equal(stat.metaData['content-encoding'], 'gzip');

    const body = await buffer(await objectStore.getObjectStream(MODEL_BUCKET, 'trajectory-a/timestep-5.glb.gz'));
    const [points] = spatialAssembler.decodeGLB(await decompressModel(body));
    const expected = frame(5);
    expected.positions.forEach((value, index) => {
        assert.ok(Math.abs(points.positions[index] - value) <= spatialAssembler.POSITION_STEP / 2 + FLOAT32_NOISE);
    });
    assert.deepEqual(points.colors, spatialAssembler.colorsByType(expected.types));
});

test('reads that arrive together convert a model once', async () => {
    const source = frameSource();
    const migration = new LegacyModelMigration(objectStore, source, CLUSTER_ID);
    await putLegacy('trajectory-b/timestep-1.glb.zst');

    const results = await Promise.all([
        migration.convertMissing(MODEL_BUCKET, 'trajectory-b/timestep-1.glb.gz'),
        migration.convertMissing(MODEL_BUCKET, 'trajectory-b/timestep-1.glb.gz')
    ]);

    assert.deepEqual(results, [true, true]);
    assert.equal(source.reads.length, 1);
});

test('a key with no legacy object behind it is left alone', async () => {
    const source = frameSource();
    const migration = new LegacyModelMigration(objectStore, source, CLUSTER_ID);

    assert.equal(await migration.convertMissing(MODEL_BUCKET, 'trajectory-c/timestep-1.glb.gz'), false);
    assert.equal(await migration.convertMissing('volt-dumps', 'trajectory-c/timestep-1.glb.gz'), false);
    assert.equal(await migration.convertMissing(MODEL_BUCKET, 'trajectory-c/timestep-1.png'), false);
    assert.equal(source.reads.length, 0);
});

test('deleting a model that was never converted removes its legacy object, and only that', async () => {
    const migration = new LegacyModelMigration(objectStore, frameSource(), CLUSTER_ID);
    await putLegacy('trajectory-d/timestep-1.glb.zst');
    await putLegacy('trajectory-d/timestep-2.glb.zst');
    await migration.convertMissing(MODEL_BUCKET, 'trajectory-d/timestep-2.glb.gz');

    assert.equal(await migration.removeMissing(MODEL_BUCKET, 'trajectory-d/timestep-1.glb.gz'), true);
    assert.equal(await migration.removeMissing(MODEL_BUCKET, 'trajectory-d/timestep-2.glb.gz'), false);
    assert.equal(await migration.removeMissing(MODEL_BUCKET, 'trajectory-d/timestep-3.glb.gz'), false);
    assert.deepEqual(await stored('trajectory-d/'), ['trajectory-d/timestep-2.glb.gz']);
});

test('the startup sweep converts every legacy model', async () => {
    const source = frameSource();
    const migration = new LegacyModelMigration(objectStore, source, CLUSTER_ID);
    await Promise.all([1, 2, 3].map((timestep) => putLegacy(`trajectory-e/timestep-${timestep}.glb.zst`)));

    await migration.sweep();

    assert.deepEqual(await stored('trajectory-e/'), [
        'trajectory-e/timestep-1.glb.gz',
        'trajectory-e/timestep-2.glb.gz',
        'trajectory-e/timestep-3.glb.gz'
    ]);
    assert.deepEqual((await objectStore.listObjects(MODEL_BUCKET, '')).filter((key) => key.endsWith('.zst')), []);
});

// The empty mesh export VOLT wrote before this format, as found on a cluster: three accessors that
// count 0 over zero-length buffer views, and an empty BIN chunk.
const LEGACY_EMPTY_EXPORT_JSON = '{"asset":{"version":"2.0","generator":"Volt Native"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0,"name":"Mesh"}],"materials":[{"pbrMetallicRoughness":{"baseColorFactor":[1.0000,0.5000,0.0000,1.0000],"metallicFactor":0.0000,"roughnessFactor":0.8000},"emissiveFactor":[0.0000,0.0000,0.0000],"doubleSided":true}],"meshes":[{"primitives":[{"attributes":{"POSITION":0,"NORMAL":1},"indices":2,"material":0,"mode":4}],"name":"MeshGeometry"}],"accessors":[{"bufferView":0,"componentType":5126,"count":0,"type":"VEC3","min":[0.000000,0.000000,0.000000],"max":[0.000000,0.000000,0.000000]},{"bufferView":1,"componentType":5126,"count":0,"type":"VEC3"},{"bufferView":2,"componentType":5125,"count":0,"type":"SCALAR"}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":0,"target":34962},{"buffer":0,"byteOffset":0,"byteLength":0,"target":34962},{"buffer":0,"byteOffset":0,"byteLength":0,"target":34963}],"buffers":[{"byteLength":0}]}';

const legacyEmptyExport = (): Buffer => {
    const json = Buffer.from(LEGACY_EMPTY_EXPORT_JSON);
    const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + jsonChunk.length + 8, 8);
    header.writeUInt32LE(jsonChunk.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, jsonChunk, binHeader]);
};

test('a legacy export with no geometry becomes an empty model', () => {
    const legacy = legacyEmptyExport();
    assert.throws(() => spatialAssembler.decodeGLB(legacy));

    const converted = toModelFormat(legacy);

    assert.deepEqual(converted, encodeEmptyModel());
    assert.deepEqual(spatialAssembler.decodeGLB(converted), []);
});
