import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike } from '@modules/cluster/contracts/team-cluster';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import daemonCredentialGuard from '@modules/cluster/services/daemon/DaemonCredentialGuard';
import ApplicationError from '@shared/errors/ApplicationError';

import type {
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayListResponse,
    TeamClusterObjectGatewayStreamResponse
} from '@shared/contracts/types/TeamClusterObjectGateway';
import type { Readable as NodeReadable } from 'node:stream';

interface TeamClusterTeamIdentity {
    props: {
        team: string;
    };
}



type FindOwnerClusterById = (ownerClusterId: string) => Promise<TeamClusterTeamIdentity | null>;


interface TeamClusterObjectStoreWriteInput {
    bucket: string;
    objectKey: string;
    stream: NodeReadable;
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    metadata: Record<string, string>;
}

interface TeamClusterObjectStoreReadOptions {
    skipMetadata?: boolean;
    rangeHeader?: string;
}

export type TeamClusterObjectStoreHeadResponse = TeamClusterObjectGatewayHeadResponse;

const requesterCredentialsBrand = Symbol('TeamClusterObjectStoreRequesterCredentials');
const authorizedAccessBrand = Symbol('TeamClusterObjectStoreAuthorizedAccess');

interface TeamClusterObjectStoreRequesterCredentials {
    readonly requesterClusterId: string;
    readonly daemonPassword: string;
    readonly [requesterCredentialsBrand]: true;
}

interface AuthorizedTeamClusterObjectStoreAccess {
    readonly ownerClusterId: string;
    readonly [authorizedAccessBrand]: true;
}

const findOwnerClusterById: FindOwnerClusterById = async (ownerClusterId) => {
    const ownerClusterEntity = await TeamClusterEntity.findOneBy({ id: ownerClusterId });
    return ownerClusterEntity ? toTeamClusterLike(ownerClusterEntity) : null;
};

class TeamClusterObjectStoreProxyService {
    requireRequesterCredentials(
        requesterClusterId: string | undefined,
        daemonPassword: string | undefined
    ): TeamClusterObjectStoreRequesterCredentials {
        if (!requesterClusterId || !daemonPassword) {
            throw ApplicationError.unauthorized(
                ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_UNAUTHORIZED,
                'Daemon authentication headers are required'
            );
        }

        return Object.freeze({
            requesterClusterId,
            daemonPassword,
            [requesterCredentialsBrand]: true as const
        });
    }

    async authorizeOwner(
        credentials: TeamClusterObjectStoreRequesterCredentials,
        ownerClusterId: string
    ): Promise<AuthorizedTeamClusterObjectStoreAccess> {
        const requesterCluster = await daemonCredentialGuard.requireByDaemonPassword(
            credentials.requesterClusterId,
            credentials.daemonPassword
        );
        const ownerCluster = await findOwnerClusterById(ownerClusterId);

        if (!ownerCluster) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_OWNER_NOT_FOUND,
                'The requested owner cluster does not exist'
            );
        }

        if (ownerCluster.props.team !== requesterCluster.props.team) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_FORBIDDEN,
                'The requested owner cluster does not belong to the same team'
            );
        }

        return Object.freeze({
            ownerClusterId,
            [authorizedAccessBrand]: true as const
        });
    }

    async list(
        access: AuthorizedTeamClusterObjectStoreAccess,
        request: TeamClusterObjectGatewayListRequest
    ): Promise<TeamClusterObjectGatewayListResponse> {
        return objectGatewayClient.list(access.ownerClusterId, request);
    }

    async deletePrefix(
        access: AuthorizedTeamClusterObjectStoreAccess,
        bucket: string,
        prefix: string
    ): Promise<number | undefined> {
        return objectGatewayClient.deleteByPrefix(access.ownerClusterId, bucket, prefix);
    }

    async head(
        access: AuthorizedTeamClusterObjectStoreAccess,
        bucket: string,
        objectKey: string
    ): Promise<TeamClusterObjectStoreHeadResponse> {
        return objectGatewayClient.head(access.ownerClusterId, bucket, objectKey);
    }

    async openRead(
        access: AuthorizedTeamClusterObjectStoreAccess,
        bucket: string,
        objectKey: string,
        options?: TeamClusterObjectStoreReadOptions
    ): Promise<TeamClusterObjectGatewayStreamResponse> {
        return objectGatewayClient.getStream(access.ownerClusterId, bucket, objectKey, options);
    }

    async write(
        access: AuthorizedTeamClusterObjectStoreAccess,
        input: TeamClusterObjectStoreWriteInput
    ): Promise<void> {
        await objectGatewayClient.putStream(access.ownerClusterId, {
            bucket: input.bucket,
            objectKey: input.objectKey,
            stream: input.stream,
            contentLength: this.#requireContentLength(input.contentLength),
            ...(input.contentType ? { contentType: input.contentType } : {}),
            ...(input.contentEncoding ? { contentEncoding: input.contentEncoding } : {}),
            metadata: input.metadata
        });
    }

    async delete(
        access: AuthorizedTeamClusterObjectStoreAccess,
        bucket: string,
        objectKey: string
    ): Promise<void> {
        await objectGatewayClient.deleteObject(access.ownerClusterId, bucket, objectKey);
    }

    #requireContentLength(contentLength: number | undefined): number {
        if (contentLength === undefined) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_CONTENT_LENGTH_REQUIRED,
                'content-length header is required for uploads'
            );
        }

        if (!Number.isInteger(contentLength) || contentLength < 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_CLUSTER_OBJECT_STORE_PROXY_INVALID_CONTENT_LENGTH,
                'content-length must be a non-negative integer'
            );
        }

        return contentLength;
    }
}

export default new TeamClusterObjectStoreProxyService();
