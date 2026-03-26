import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import {
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
    type TeamClusterDirectAccessGrantRequest,
    type TeamClusterDirectAccessGrantResponse
} from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import { inject, injectable } from 'tsyringe';
import TeamClusterDirectAccessTokenService from './TeamClusterDirectAccessTokenService';
import TeamClusterExposureRegistryService from './TeamClusterExposureRegistryService';
import VoltServerObjectGatewayService from './VoltServerObjectGatewayService';

const DIRECT_ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

interface GrantRequester {
    kind: 'daemon' | 'server';
    id: string;
}

@injectable()
export default class TeamClusterDirectAccessGrantService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterExposureRegistryService)
        private readonly exposureRegistryService: TeamClusterExposureRegistryService,

        @inject(DaemonCredentialGuard)
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        @inject(TeamClusterDirectAccessTokenService)
        private readonly tokenService: TeamClusterDirectAccessTokenService,

        @inject(VoltServerObjectGatewayService)
        private readonly voltServerObjectGatewayService: VoltServerObjectGatewayService
    ) {}

    async authorizeDaemonGrant(
        requesterClusterId: string,
        daemonPassword: string,
        request: TeamClusterDirectAccessGrantRequest
    ): Promise<TeamClusterDirectAccessGrantResponse> {
        const requesterCluster = await this.daemonCredentialGuard.requireByDaemonPassword(
            requesterClusterId,
            daemonPassword
        );

        if (request.ownerClusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID) {
            return this.issueVoltServerGrant(
                {
                    kind: 'daemon',
                    id: requesterCluster.id
                },
                requesterCluster.props.team,
                request
            );
        }

        const ownerCluster = await this.requireOwnerCluster(request.ownerClusterId);

        if (requesterCluster.props.team !== ownerCluster.props.team) {
            throw ApplicationError.forbidden(
                'TeamCluster::DirectAccessForbidden',
                'The requested owner cluster does not belong to the same team'
            );
        }

        return this.issueGrant(
            {
                kind: 'daemon',
                id: requesterCluster.id
            },
            ownerCluster,
            request
        );
    }

    async issueInternalGrant(
        ownerClusterId: string,
        exposureName: string,
        accessMode: TeamClusterServiceExposureAccessMode
    ): Promise<TeamClusterDirectAccessGrantResponse> {
        const ownerCluster = await this.requireOwnerCluster(ownerClusterId);

        return this.issueGrant(
            {
                kind: 'server',
                id: 'volt-server'
            },
            ownerCluster,
            {
                ownerClusterId,
                exposureName,
                accessMode
            }
        );
    }

    private async issueGrant(
        requester: GrantRequester,
        ownerCluster: Awaited<ReturnType<DaemonCredentialGuard['requireByDaemonPassword']>>,
        request: TeamClusterDirectAccessGrantRequest
    ): Promise<TeamClusterDirectAccessGrantResponse> {
        const exposure = this.requireExposure(
            ownerCluster.id,
            request.exposureName,
            request.accessMode
        );
        const daemonPassword = await this.daemonCredentialGuard.getDecryptedDaemonPassword(ownerCluster);
        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + DIRECT_ACCESS_TOKEN_TTL_SECONDS;

        return {
            ownerClusterId: ownerCluster.id,
            exposureName: exposure.exposureName,
            exposureId: exposure.id,
            accessMode: request.accessMode,
            endpoint: exposure.publicAccess!,
            token: this.tokenService.create(daemonPassword, {
                requesterKind: requester.kind,
                requesterId: requester.id,
                ownerClusterId: ownerCluster.id,
                teamId: ownerCluster.props.team,
                exposureId: exposure.id,
                exposureName: exposure.exposureName,
                accessMode: request.accessMode,
                iat: issuedAt,
                exp: expiresAt
            }),
            expiresAt: new Date(expiresAt * 1000).toISOString()
        };
    }

    private issueVoltServerGrant(
        requester: GrantRequester,
        teamId: string,
        request: TeamClusterDirectAccessGrantRequest
    ): TeamClusterDirectAccessGrantResponse {
        if (
            request.exposureName !== 'object-gateway'
            || request.accessMode !== TeamClusterServiceExposureAccessMode.Http
        ) {
            throw ApplicationError.notFound(
                'TeamCluster::DirectAccessExposureNotFound',
                'The requested Volt server exposure is not available'
            );
        }

        return this.voltServerObjectGatewayService.issueGrant(requester, teamId);
    }

    private requireExposure(
        ownerClusterId: string,
        exposureName: string,
        accessMode: TeamClusterServiceExposureAccessMode
    ): TeamClusterServiceExposure {
        const exposure = this.exposureRegistryService.findTeamClusterExposure(ownerClusterId, (candidate) => {
            return candidate.status === TeamClusterServiceExposureStatus.Active
                && candidate.exposureName === exposureName
                && candidate.accessModes.includes(accessMode);
        });

        if (!exposure) {
            throw ApplicationError.notFound(
                'TeamCluster::DirectAccessExposureNotFound',
                'The requested owner exposure is not available'
            );
        }

        if (!exposure.publicAccess) {
            throw ApplicationError.conflict(
                'TeamCluster::DirectAccessExposureUnavailable',
                'The requested owner exposure is not published for direct access'
            );
        }

        return exposure;
    }

    private async requireOwnerCluster(ownerClusterId: string) {
        const ownerCluster = await this.teamClusterRepository.findByIdWithSensitiveData(ownerClusterId);
        if (!ownerCluster) {
            throw ApplicationError.notFound(
                'TeamCluster::DirectAccessOwnerNotFound',
                'The requested owner cluster does not exist'
            );
        }

        return ownerCluster;
    }
}
