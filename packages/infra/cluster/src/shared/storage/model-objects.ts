import { promisify } from 'node:util';
import { constants, gunzip, gzip } from 'node:zlib';
import spatialAssembler from '@voltstack/spatial-assembler';
import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';

// Every model the daemon stores is a SpatialAssembler glTF binary (16-bit positions on a 0.01 Å
// grid, RGBA8 colours, meshopt-compressed), gzipped once when written, under a key ending in
// MODEL_OBJECT_SUFFIX. The server streams those bytes untouched with Content-Encoding: gzip, which
// every browser and HTTP client decodes natively, so no reader carries a decompressor of its own.
export const MODEL_OBJECT_SUFFIX = '.glb.gz';
export const MODEL_CONTENT_TYPE = 'model/gltf-binary';
export const MODEL_CONTENT_ENCODING = 'gzip';
export const MODEL_BUCKET = TEAM_CLUSTER_OBJECT_STORE_BUCKET.Models;

export const MODEL_OBJECT_METADATA: Readonly<Record<string, string>> = {
    'Content-Type': MODEL_CONTENT_TYPE,
    'Content-Encoding': MODEL_CONTENT_ENCODING
};

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const isModelObjectKey = (objectKey: string): boolean => objectKey.endsWith(MODEL_OBJECT_SUFFIX);

export const toModelObjectKey = (objectKey: string): string => {
    if (isModelObjectKey(objectKey)) return objectKey;
    return objectKey.endsWith('.glb') ? `${objectKey}.gz` : `${objectKey}.glb.gz`;
};

export const compressModel = (glb: Uint8Array): Promise<Buffer> =>
    gzipAsync(glb, { level: constants.Z_BEST_COMPRESSION });

export const decompressModel = (body: Uint8Array): Promise<Buffer> => gunzipAsync(body);

export const encodeEmptyModel = (): Buffer => spatialAssembler.encodePointCloud(new Float32Array(0));

export const putModel = async (
    objectStore: Pick<ClusterObjectStore, 'putObject'>,
    ownerClusterId: string,
    objectKey: string,
    glb: Uint8Array
): Promise<void> => {
    await objectStore.putObject({
        ownerClusterId,
        bucket: MODEL_BUCKET,
        objectKey,
        body: await compressModel(glb),
        metadata: { ...MODEL_OBJECT_METADATA }
    });
};

const GLB_MAGIC = 0x46546c67;

// The JSON chunk of a model in the current format declares the meshopt extension.
const isCurrentFormat = (glb: Buffer): boolean => {
    if (glb.length < 20 || glb.readUInt32LE(0) !== GLB_MAGIC) return false;
    const jsonLength = glb.readUInt32LE(12);
    return glb.subarray(20, 20 + jsonLength).includes('"EXT_meshopt_compression"');
};

/**
 * A glTF binary written elsewhere (a plugin, an older SDK, a model stored before this format),
 * re-encoded into the current format. Points keep their order and triangles theirs, so masks and
 * triangle ranges computed on the original still apply. Models with anything other than a single
 * point or triangle primitive are returned as they are.
 */
export const toModelFormat = (glb: Buffer): Buffer => {
    if (isCurrentFormat(glb)) return glb;

    const primitives = spatialAssembler.decodeGLB(glb);
    if (primitives.length !== 1) return glb;

    const [primitive] = primitives;
    if (primitive.mode === 'points') {
        return spatialAssembler.encodePointCloud(primitive.positions, primitive.colors);
    }
    if (!primitive.normals || !primitive.indices) return glb;
    return spatialAssembler.encodeMesh(
        primitive.positions,
        primitive.normals,
        primitive.indices,
        primitive.colors,
        primitive.material
    );
};
