import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike } from '@modules/cluster/contracts/domain/team-cluster';
import defaultObjectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import DaemonCredentialGuard from '@modules/cluster/services/DaemonCredentialGuard';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
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

interface DaemonCredentialVerifier {
    requireByDaemonPassword(
        teamClusterId: string,
        daemonPassword: string
    ): Promise<TeamClusterTeamIdentity>;
}

type TeamClusterObjectStoreGateway = Pick<
    ITeamClusterObjectGatewayClient,
    'list' | 'deleteByPrefix' | 'head' | 'getStream' | 'putStream' | 'deleteObject'
>;

type FindOwnerClusterById = (ownerClusterId: string) => Promise<TeamClusterTeamIdentity | null>;

export interface TeamClusterObjectStoreProxyServiceDependencies {
    daemonCredentialGuard?: DaemonCredentialVerifier;
    objectGatewayClient?: TeamClusterObjectStoreGateway;
    findOwnerClusterById?: FindOwnerClusterById;
}

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
type TeamClusterObjectStoreReadResponse = TeamClusterObjectGatewayStreamResponse;

const requesterCredentialsBrand = Symbol('TeamClusterObjectStoreRequesterCredentials');
const authorizedAccessBrand = Symbol('TeamClusterObjectStoreAuthorizedAccess');

interface TeamClusterObjectStoreRequesterCredentials {
    readonly requesterClusterId: string;
    readonly daemonPassword: string;
    readonly [requesterCredentialsBrand]: true;
}

export interface AuthorizedTeamClusterObjectStoreAccess {
    readonly ownerClusterId: string;
    readonly [authorizedAccessBrand]: true;
}

const findOwnerClusterById: FindOwnerClusterById = async (ownerClusterId) => {
    const ownerClusterEntity = await TeamClusterEntity.findOneBy({ id: ownerClusterId });
    return ownerClusterEntity ? toTeamClusterLike(ownerClusterEntity) : null;
};

export default class TeamClusterObjectStoreProxyService {
    readonly #daemonCredentialGuard: DaemonCredentialVerifier;
    readonly #objectGatewayClient: TeamClusterObjectStoreGateway;
    readonly #findOwnerClusterById: FindOwnerClusterById;

    constructor(dependencies: TeamClusterObjectStoreProxyServiceDependencies = {}) {
        this.#daemonCredentialGuard = dependencies.daemonCredentialGuard ?? new DaemonCredentialGuard();
        this.#objectGatewayClient = dependencies.objectGatewayClient ?? defaultObjectGatewayClient;
        this.#findOwnerClusterById = dependencies.findOwnerClusterById ?? findOwnerClusterById;
    }

    requireRequesterCredentials(
        requesterClusterId: string | undefined,
        daemonPassword: string | undefined
    ): TeamClusterObjectStoreRequesterCredentials {
        if (!requesterClusterId || !daemonPassword) {
            throw ApplicationError.unauthorized(
                'TeamCluster::ObjectStoreProxyUnauthorized',
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
        this.#assertRequesterCredentials(credentials);

        const requesterCluster = await this.#daemonCredentialGuard.requireByDaemonPassword(
            credentials.requesterClusterId,
            credentials.daemonPassword
        );
        const ownerCluster = await this.#findOwnerClusterById(ownerClusterId);

        if (!ownerCluster) {
            throw ApplicationError.notFound(
                'TeamCluster::ObjectStoreProxyOwnerNotFound',
                'The requested owner cluster does not exist'
            );
        }

        if (ownerCluster.props.team !== requesterCluster.props.team) {
            throw ApplicationError.forbidden(
                'TeamCluster::ObjectStoreProxyForbidden',
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
        return this.#objectGatewayClient.list(this.#requireAuthorizedOwnerId(access), request);
    }

    async deletePrefix(
        access: AuthorizedTeamClusterObjectStoreAccess,
        bucket: string,
        prefix: string
    ): Promise<number | undefined> {
        return this.#objectGatewayClient.deleteByPrefix(
            this.#requireAuthorizedOwnerId(access),
            bucket,
            prefix
        );
    }

    async head(
        access: AuthorizedTeamClusterObjectStoreAccess,
        bucket: string,
        objectKey: string
    ): Promise<TeamClusterObjectStoreHeadResponse> {
        return this.#objectGatewayClient.head(
            this.#requireAuthorizedOwnerId(access),
            bucket,
            objectKey
        );
    }

    async openRead(
        access: AuthorizedTeamClusterObjectStoreAccess,
        bucket: string,
        objectKey: string,
        options?: TeamClusterObjectStoreReadOptions
    ): Promise<TeamClusterObjectStoreReadResponse> {
        return this.#objectGatewayClient.getStream(
            this.#requireAuthorizedOwnerId(access),
            bucket,
            objectKey,
            options
        );
    }

    async write(
        access: AuthorizedTeamClusterObjectStoreAccess,
        input: TeamClusterObjectStoreWriteInput
    ): Promise<void> {
        const ownerClusterId = this.#requireAuthorizedOwnerId(access);
        const contentLength = this.#requireContentLength(input.contentLength);

        await this.#objectGatewayClient.putStream(ownerClusterId, {
            bucket: input.bucket,
            objectKey: input.objectKey,
            stream: input.stream,
            contentLength,
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
        await this.#objectGatewayClient.deleteObject(
            this.#requireAuthorizedOwnerId(access),
            bucket,
            objectKey
        );
    }

    #assertRequesterCredentials(credentials: TeamClusterObjectStoreRequesterCredentials): void {
        if (credentials?.[requesterCredentialsBrand] !== true) {
            throw ApplicationError.unauthorized(
                'TeamCluster::ObjectStoreProxyUnauthorized',
                'Daemon authentication headers are required'
            );
        }
    }

    #requireAuthorizedOwnerId(access: AuthorizedTeamClusterObjectStoreAccess): string {
        if (access?.[authorizedAccessBrand] !== true) {
            throw ApplicationError.forbidden(
                'TeamCluster::ObjectStoreProxyForbidden',
                'The requested owner cluster does not belong to the same team'
            );
        }

        return access.ownerClusterId;
    }

    #requireContentLength(contentLength: number | undefined): number {
        if (typeof contentLength === 'undefined') {
            throw ApplicationError.badRequest(
                'TeamCluster::ObjectStoreProxyContentLengthRequired',
                'content-length header is required for uploads'
            );
        }

        if (!Number.isInteger(contentLength) || contentLength < 0) {
            throw ApplicationError.badRequest(
                'TeamCluster::ObjectStoreProxyInvalidContentLength',
                'content-length must be a non-negative integer'
            );
        }

        return contentLength;
    }
}
