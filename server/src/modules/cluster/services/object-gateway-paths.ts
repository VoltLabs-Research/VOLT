
import {
    TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX,
    TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER
} from '@shared/infrastructure/contracts/team-cluster';
import type {
    TeamClusterObjectGatewayPutRequest
} from '@shared/contracts/types/TeamClusterObjectGateway';

const OBJECT_GATEWAY_BASE_PATH = '/internal/object-gateway/v1';

export interface TeamClusterObjectGatewayReadOptions {
    skipMetadata?: boolean;
    rangeHeader?: string;
}

const encodeObjectKeyPath = (objectKey: string): string => (
    objectKey.split('/').map(encodeURIComponent).join('/')
);

/* Request path and header construction for the cluster object gateway. */

export const buildCollectionPath = (bucket: string): string => {
    return `${OBJECT_GATEWAY_BASE_PATH}/buckets/${encodeURIComponent(bucket)}/objects`;
};

export const buildObjectPath = (bucket: string, objectKey: string): string => {
    return `${buildCollectionPath(bucket)}/${encodeObjectKeyPath(objectKey)}`;
};

export const buildComposePath = (bucket: string): string => {
    return `${buildCollectionPath(bucket)}/compose`;
};

export const buildUploadHeaders = (request: TeamClusterObjectGatewayPutRequest): Record<string, string> => {
    const headers: Record<string, string> = {
        'content-length': String(request.contentLength)
    };

    if (request.contentType) {
        headers['content-type'] = request.contentType;
    }

    if (request.contentEncoding) {
        headers['content-encoding'] = request.contentEncoding;
    }

    for (const [key, value] of Object.entries(request.metadata ?? {})) {
        headers[`${TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX}${key.toLowerCase()}`] = value;
    }

    return headers;
};

export const buildReadHeaders = (options?: TeamClusterObjectGatewayReadOptions): Record<string, string> | undefined => {
    const headers: Record<string, string> = {};

    if (options?.skipMetadata) {
        headers[TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER] = '1';
    }

    if (options?.rangeHeader) {
        headers.range = options.rangeHeader;
    }

    return Object.keys(headers).length > 0 ? headers : undefined;
};
