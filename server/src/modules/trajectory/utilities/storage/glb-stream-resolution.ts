import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { PassThrough, Transform } from 'node:stream';
import { Decompress as ZstdDecompress } from 'fzstd';
import zlib from 'node:zlib';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import {
    isZstdObjectName,
    stripTrailingZstdExtension
} from './trajectory-storage-codec';
import type { Readable } from 'node:stream';

export type GlbContentEncoding = 'zstd' | 'gzip' | 'br' | 'identity';

interface ResolvedGlbStream {
    stream: Readable;
    objectName: string;
    size?: number;
    /**
     * Content-Encoding under which the stream bytes are currently compressed.
     * Controllers forward this to the client so the browser decompresses the
     * GLB natively (no JS-side zstd work on the critical path).
     */
    contentEncoding: GlbContentEncoding;
};

interface GlbStreamRequestContext {
    /**
     * Parsed `Accept-Encoding` header from the inbound request. Used to pick
     * between passthrough zstd and a server-side re-encode fallback.
     */
    acceptEncoding: string | undefined;
}

const supportsEncoding = (acceptEncoding: string | undefined, token: 'zstd' | 'br' | 'gzip'): boolean => {
    if (!acceptEncoding) return false;
    const entries = acceptEncoding.toLowerCase().split(',').map((part) => part.trim());
    return entries.some((entry) => {
        if (!entry) return false;
        const [name, ...params] = entry.split(';').map((segment) => segment.trim());
        if (name !== token) return false;
        const q = params.find((param) => param.startsWith('q='));
        if (!q) return true;
        const value = Number.parseFloat(q.slice(2));
        return Number.isFinite(value) && value > 0;
    });
};

/**
 * Wraps a `.zst` stream with an in-process decompressor. Produces a Readable of
 * raw (identity-encoded) GLB bytes using the pure-JS `fzstd` implementation —
 * no `spawn('zstd')`, no native addon. Acceptable for the fallback path only.
 */
const createInProcessZstdDecompressionStream = (input: Readable): Readable => {
    const output = new PassThrough();
    const decompressor = new ZstdDecompress((chunk, final) => {
        if (chunk.byteLength > 0) {
            output.write(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        }

        if (final) {
            output.end();
        }
    });

    input.on('data', (buffer: Buffer) => {
        try {
            decompressor.push(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength), false);
        } catch (error) {
            output.destroy(error instanceof Error ? error : new Error(String(error)));
        }
    });

    input.on('end', () => {
        try {
            decompressor.push(new Uint8Array(0), true);
        } catch (error) {
            output.destroy(error instanceof Error ? error : new Error(String(error)));
        }
    });

    input.on('error', (error) => {
        output.destroy(error);
    });

    return output;
};

/**
 * Pipes a raw stream through a gzip transform, producing gzip-encoded bytes.
 */
const createGzipReencodeStream = (input: Readable): Readable => {
    const gzip = zlib.createGzip({ level: zlib.constants.Z_DEFAULT_COMPRESSION });
    input.on('error', (error) => gzip.destroy(error));
    return input.pipe(gzip) as unknown as Transform;
};

const finalizeGlbStream = (
    sourceCompressed: Readable,
    objectName: string,
    requestContext: GlbStreamRequestContext
): ResolvedGlbStream => {
    const normalizedObjectName = stripTrailingZstdExtension(objectName);

    if (supportsEncoding(requestContext.acceptEncoding, 'zstd')) {
        // Passthrough: ship the .glb.zst bytes unchanged; the browser handles
        // decompression natively. Chrome 123+, Firefox 126+ advertise `zstd`
        // in Accept-Encoding.
        return {
            stream: sourceCompressed,
            objectName: normalizedObjectName,
            contentEncoding: 'zstd'
        };
    }

    const decompressed = createInProcessZstdDecompressionStream(sourceCompressed);

    if (supportsEncoding(requestContext.acceptEncoding, 'gzip')) {
        return {
            stream: createGzipReencodeStream(decompressed),
            objectName: normalizedObjectName,
            contentEncoding: 'gzip'
        };
    }

    return {
        stream: decompressed,
        objectName: normalizedObjectName,
        contentEncoding: 'identity'
    };
};

export const getClusterGlbStream = async (
    objectGatewayClient: TeamClusterObjectGatewayClient,
    teamClusterId: string,
    objectName: string,
    requestContext: GlbStreamRequestContext
): Promise<ResolvedGlbStream> => {
    if (!isZstdObjectName(objectName)) {
        throw new Error(`Unsupported GLB object key: ${objectName}`);
    }

    const response = await objectGatewayClient.getStream(teamClusterId, TEAM_CLUSTER_BUCKETS.MODELS, objectName);
    return {
        ...finalizeGlbStream(response.stream, objectName, requestContext),
        size: response.contentLength
    };
};
