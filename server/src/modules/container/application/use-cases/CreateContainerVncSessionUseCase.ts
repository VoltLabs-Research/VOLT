import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerVncSessionInputDTO, CreateContainerVncSessionOutputDTO } from '@modules/container/application/dtos/CreateContainerVncSessionDTO';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { ContainerVncGatewayService } from '@modules/container/infrastructure/services/ContainerVncGatewayService';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterExposureRegistryService from '@modules/team-cluster/infrastructure/services/TeamClusterExposureRegistryService';
import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureStatus } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

const VNC_PRIVATE_PORT = 5901;

@injectable()
export class CreateContainerVncSessionUseCase implements IUseCase<CreateContainerVncSessionInputDTO, CreateContainerVncSessionOutputDTO> {
    constructor(
        @inject(ContainerOwnershipService)
        private readonly ownershipService: ContainerOwnershipService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterExposureRegistryService)
        private readonly exposureRegistryService: TeamClusterExposureRegistryService,

        @inject(ContainerVncGatewayService)
        private readonly vncGatewayService: ContainerVncGatewayService
    ) {}

    async execute(input: CreateContainerVncSessionInputDTO): Promise<Result<CreateContainerVncSessionOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);

        if (!container.capabilities?.vnc) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'This container does not support VNC sessions'
            );
        }

        if (!container.teamCluster) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container cluster runtime was not found');
        }

        const exposure = this.exposureRegistryService.findTeamClusterExposure(container.teamCluster, (currentExposure) => {
            return currentExposure.containerId === container.containerId
                && currentExposure.containerPort === VNC_PRIVATE_PORT
                && currentExposure.status === TeamClusterServiceExposureStatus.Active
                && currentExposure.accessModes.includes(TeamClusterServiceExposureAccessMode.Tcp);
        });

        if (!exposure) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'VNC exposure is not available for this container'
            );
        }

        const session = this.vncGatewayService.createSession({
            teamId: input.teamId,
            containerId: input.containerId,
            userId: input.userId,
            teamClusterId: container.teamCluster,
            exposureId: exposure.id,
            password: input.password,
            parentOrigin: input.parentOrigin,
            width: input.width,
            height: input.height,
            dpi: input.dpi
        });

        return Result.ok({ session });
    }
};
