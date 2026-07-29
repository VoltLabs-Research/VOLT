import defaultObjectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { IClusterObjectSignedUrlService, ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type {
    ClusterObjectAccessClaims,
    ClusterObjectOperation
} from '@shared/contracts/types/ClusterObjectGateway';
import type {
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayStreamResponse
} from '@shared/contracts/types/TeamClusterObjectGateway';
import type { Readable as NodeReadable } from 'node:stream';

type ClusterObjectSignedUrlVerifier = Pick<IClusterObjectSignedUrlService, 'verify'>;
type ClusterObjectTransferGateway = Pick<
    ITeamClusterObjectGatewayClient,
    'putStream' | 'head' | 'getStream'
>;

export interface ClusterObjectTransferServiceDependencies {
    signedUrlService?: ClusterObjectSignedUrlVerifier;
    objectGatewayClient?: ClusterObjectTransferGateway;
}

interface ClusterObjectTransferWriteInput {
    stream: NodeReadable;
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
}

interface ClusterObjectTransferReadOptions {
    rangeHeader?: string;
}

type ClusterObjectTransferHeadResponse = TeamClusterObjectGatewayHeadResponse;
export type ClusterObjectTransferReadResponse = TeamClusterObjectGatewayStreamResponse;

export default class ClusterObjectTransferService {
    readonly #signedUrlService: ClusterObjectSignedUrlVerifier;
    readonly #objectGatewayClient: ClusterObjectTransferGateway;

    constructor(dependencies: ClusterObjectTransferServiceDependencies = {}) {
        this.#signedUrlService = dependencies.signedUrlService ?? new ClusterObjectSignedUrlService();
        this.#objectGatewayClient = dependencies.objectGatewayClient ?? defaultObjectGatewayClient;
    }

    async write(
        teamId: string | undefined,
        token: string | undefined,
        input: ClusterObjectTransferWriteInput
    ): Promise<void> {
        const claims = this.#resolveClaims(teamId, token, 'write');
        const contentLength = this.#requireContentLength(input.contentLength);

        if (typeof claims.contentLength === 'number' && claims.contentLength !== contentLength) {
            throw ApplicationError.badRequest(
                'ClusterObject::ContentLengthMismatch',
                'Uploaded object size does not match the signed URL'
            );
        }

        await this.#objectGatewayClient.putStream(claims.ownerClusterId, {
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
    ): Promise<ClusterObjectTransferHeadResponse> {
        const claims = this.#resolveClaims(teamId, token, 'read');
        return this.#objectGatewayClient.head(
            claims.ownerClusterId,
            claims.bucket,
            claims.objectKey
        );
    }

    async openRead(
        teamId: string | undefined,
        token: string | undefined,
        options: ClusterObjectTransferReadOptions = {}
    ): Promise<ClusterObjectTransferReadResponse> {
        const claims = this.#resolveClaims(teamId, token, 'read');
        return this.#objectGatewayClient.getStream(
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
        const claims = token ? this.#signedUrlService.verify(token) : null;

        if (!claims || claims.operation !== operation || claims.teamId !== teamId) {
            throw ApplicationError.unauthorized(
                'ClusterObject::InvalidSignedUrl',
                'Object URL is invalid or expired'
            );
        }

        return claims;
    }

    #requireContentLength(contentLength: number | undefined): number {
        if (!Number.isInteger(contentLength) || contentLength! < 0) {
            throw ApplicationError.badRequest(
                'ClusterObject::ContentLengthRequired',
                'content-length header is required for object uploads'
            );
        }

        return contentLength!;
    }
}
