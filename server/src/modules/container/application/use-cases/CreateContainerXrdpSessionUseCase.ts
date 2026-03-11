import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerXrdpSessionInputDTO, CreateContainerXrdpSessionOutputDTO } from '@modules/container/application/dtos/CreateContainerXrdpSessionDTO';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { ContainerXrdpGatewayService } from '@modules/container/infrastructure/services/ContainerXrdpGatewayService';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterExposureRegistryService from '@modules/team-cluster/infrastructure/services/TeamClusterExposureRegistryService';
import type TeamClusterTcpExposureRelayService from '@modules/team-cluster/infrastructure/services/TeamClusterTcpExposureRelayService';
import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureStatus } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

const XRDP_PRIVATE_PORT = 3389;

@injectable()
export class CreateContainerXrdpSessionUseCase implements IUseCase<CreateContainerXrdpSessionInputDTO, CreateContainerXrdpSessionOutputDTO> {
    constructor(
        @inject(ContainerOwnershipService)
        private readonly ownershipService: ContainerOwnershipService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterExposureRegistryService)
        private readonly exposureRegistryService: TeamClusterExposureRegistryService,

        @inject(ContainerXrdpGatewayService)
        private readonly xrdpGatewayService: ContainerXrdpGatewayService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterTcpExposureRelayService)
        private readonly tcpExposureRelayService: TeamClusterTcpExposureRelayService
    ) {}

    async execute(input: CreateContainerXrdpSessionInputDTO): Promise<Result<CreateContainerXrdpSessionOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);

        if (!container.capabilities?.xrdp) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'This container does not support XRDP sessions'
            );
        }

        if (!container.teamCluster) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container cluster runtime was not found');
        }

        const exposure = this.exposureRegistryService.findTeamClusterExposure(container.teamCluster, (currentExposure) => {
            return currentExposure.containerId === container.containerId
                && currentExposure.containerPort === XRDP_PRIVATE_PORT
                && currentExposure.status === TeamClusterServiceExposureStatus.Active
                && currentExposure.accessModes.includes(TeamClusterServiceExposureAccessMode.Tcp);
        });

        if (!exposure) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'XRDP exposure is not available for this container'
            );
        }

        const relayPort = await this.tcpExposureRelayService.ensurePublicPort(exposure.id);
        if (!relayPort) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'XRDP exposure is no longer available for this container'
            );
        }

        const session = this.xrdpGatewayService.createSession({
            teamId: input.teamId,
            containerId: input.containerId,
            userId: input.userId,
            host: this.tcpExposureRelayService.getRelayAdvertisedHost(),
            port: relayPort,
            username: input.username,
            password: input.password,
            width: input.width,
            height: input.height,
            dpi: input.dpi
        });

        return Result.ok({ session });
    }
};
