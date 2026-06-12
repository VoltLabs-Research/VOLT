import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type { Readable } from 'node:stream';

/**
 * Neutral GLB stream resolver. Mirrors trajectory's
 * `glb-stream-resolution` util but takes the neutral
 * {@link ITeamClusterObjectGatewayClient} port (it only calls `.getStream`)
 * instead of the concrete cluster gateway class — so cross-module consumers
 * (e.g. plugin exposure GLB) can resolve a model stream without importing
 * `@modules/cluster` or `@modules/trajectory`. The codec helpers are trivial
 * pure string ops, inlined here to keep the file free of module imports.
 */
export type GlbContentEncoding = 'zstd' | 'identity';

export interface ResolvedGlbStream {
    stream: Readable;
    objectName: string;
    size?: number;
    contentEncoding: GlbContentEncoding;
}

export interface GlbStreamRequestContext {
    acceptEncoding: string | undefined;
}

const isZstdObjectName = (objectName: string): boolean => objectName.endsWith('.zst');

const stripTrailingZstdExtension = (objectName: string): string => (
    isZstdObjectName(objectName) ? objectName.slice(0, -'.zst'.length) : objectName
);

export const getClusterGlbStream = async (
    objectGatewayClient: ITeamClusterObjectGatewayClient,
    teamClusterId: string,
    objectName: string,
    _requestContext: GlbStreamRequestContext
): Promise<ResolvedGlbStream> => {
    if (!isZstdObjectName(objectName)) {
        throw new Error(`Unsupported GLB object key: ${objectName}`);
    }

    const response = await objectGatewayClient.getStream(teamClusterId, TEAM_CLUSTER_BUCKETS.MODELS, objectName);

    return {
        stream: response.stream,
        objectName: stripTrailingZstdExtension(objectName),
        size: response.contentLength,
        contentEncoding: 'identity'
    };
};
