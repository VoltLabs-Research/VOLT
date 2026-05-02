import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerPortProxySessionInputDTO, CreateContainerPortProxySessionOutputDTO } from '@modules/container/application/dtos/GetContainerByIdDTO';
import { ContainerAccessiblePortResolver } from '@modules/container/infrastructure/services/ContainerAccessiblePortResolver';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { ContainerPortProxyRelayService } from '@modules/container/infrastructure/services/ContainerPortProxyRelayService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class CreateContainerPortProxySessionUseCase implements IUseCase<
    CreateContainerPortProxySessionInputDTO,
    CreateContainerPortProxySessionOutputDTO
> {
    constructor(
        private readonly ownershipService: ContainerOwnershipService,
        private readonly accessiblePortResolver: ContainerAccessiblePortResolver,
        private readonly relayService: ContainerPortProxyRelayService
    ) {}

    async execute(input: CreateContainerPortProxySessionInputDTO): Promise<Result<CreateContainerPortProxySessionOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);
        const accessiblePorts = this.accessiblePortResolver.resolve(
            input.teamId,
            container._id,
            container.ports,
            container.status
        );
        const port = accessiblePorts.find((item) => item.private === input.privatePort);

        if (!port) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Container port is not exposed'
            ));
        }

        if (!port.browserAccessible) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Container port is not browser accessible'
            ));
        }

        if (port.status !== 'available') {
            return Result.fail(ApplicationError.conflict(
                'Container::PortUnavailable',
                'Container must be running to open this port'
            ));
        }

        if (!container.teamCluster || !container.internalIp) {
            return Result.fail(ApplicationError.conflict(
                'Container::PortUnavailable',
                'Container networking is not ready yet'
            ));
        }

        const session = await this.relayService.createSession({
            teamId: input.teamId,
            containerId: container._id,
            userId: input.userId,
            teamClusterId: container.teamCluster,
            internalIp: container.internalIp,
            privatePort: input.privatePort
        });

        return Result.ok({
            url: session.url,
            expiresAt: session.expiresAt,
            port
        });
    }
}
