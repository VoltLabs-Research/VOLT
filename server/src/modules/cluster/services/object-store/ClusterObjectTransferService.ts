import { ErrorCodes } from '@core/constants/error-codes';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import clusterObjectSignedUrlService from '@modules/cluster/services/object-store/ClusterObjectSignedUrlService';
import ApplicationError from '@shared/errors/ApplicationError';

import type {
    ClusterObjectAccessClaims,
    ClusterObjectOperation
} from '@shared/contracts/types/ClusterObjectGateway';
import type {
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayStreamResponse
} from '@shared/contracts/types/TeamClusterObjectGateway';
import type { Readable as NodeReadable } from 'node:stream';

interface ClusterObjectTransferWriteInput {
    stream: NodeReadable;
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
}

interface ClusterObjectTransferReadOptions {
    rangeHeader?: string;
}

class ClusterObjectTransferService {
    async write(
        teamId: string | undefined,
        token: string | undefined,
        input: ClusterObjectTransferWriteInput
    ): Promise<void> {
        const claims = this.#resolveClaims(teamId, token, 'write');
        const contentLength = this.#requireContentLength(input.contentLength);

        if (claims.contentLength !== undefined && claims.contentLength !== contentLength) {
            throw ApplicationError.badRequest(
                ErrorCodes.CLUSTER_OBJECT_CONTENT_LENGTH_MISMATCH,
                'Uploaded object size does not match the signed URL'
            );
        }

        await objectGatewayClient.putStream(claims.ownerClusterId, {
            bucket: claims.bucket,
            objectKey: claims.objectKey,
            stream: input.stream,
            contentLength,
            contentType: input.contentType || claims.contentType || 'application/octet-stream',
            contentEncoding: input.contentEncoding || undefined,
            metadata: claims.metadata
        });
    }

    async head(
        teamId: string | undefined,
        token: string | undefined
    ): Promise<TeamClusterObjectGatewayHeadResponse> {
        const claims = this.#resolveClaims(teamId, token, 'read');
        return objectGatewayClient.head(
            claims.ownerClusterId,
            claims.bucket,
            claims.objectKey
        );
    }

    async openRead(
        teamId: string | undefined,
        token: string | undefined,
        options: ClusterObjectTransferReadOptions = {}
    ): Promise<TeamClusterObjectGatewayStreamResponse> {
        const claims = this.#resolveClaims(teamId, token, 'read');
        return objectGatewayClient.getStream(
            claims.ownerClusterId,
            claims.bucket,
            claims.objectKey,
            {
                skipMetadata: true,
                ...(options.rangeHeader ? { rangeHeader: options.rangeHeader } : {})
            }
        );
    }

    #resolveClaims(
        teamId: string | undefined,
        token: string | undefined,
        operation: ClusterObjectOperation
    ): ClusterObjectAccessClaims {
        const claims = token ? clusterObjectSignedUrlService.verify(token) : null;

        if (!claims || claims.operation !== operation || claims.teamId !== teamId) {
            throw ApplicationError.unauthorized(
                ErrorCodes.CLUSTER_OBJECT_INVALID_SIGNED_URL,
                'Object URL is invalid or expired'
            );
        }

        return claims;
    }

    #requireContentLength(contentLength: number | undefined): number {
        if (contentLength === undefined || !Number.isInteger(contentLength) || contentLength < 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.CLUSTER_OBJECT_CONTENT_LENGTH_REQUIRED,
                'content-length header is required for object uploads'
            );
        }

        return contentLength;
    }
}

export default new ClusterObjectTransferService();
