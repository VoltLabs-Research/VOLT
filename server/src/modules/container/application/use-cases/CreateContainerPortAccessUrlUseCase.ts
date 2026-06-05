import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerPortAccessUrlInputDTO, CreateContainerPortAccessUrlOutputDTO } from '@modules/container/application/dtos/GetContainerByIdDTO';
import type { IContainerAccessiblePortResolver } from '@modules/container/domain/port/IContainerAccessiblePortResolver';
import type { IContainerOwnershipService } from '@modules/container/domain/port/IContainerOwnershipService';
import type { IContainerPortProxyRelayService } from '@modules/container/domain/port/IContainerPortProxyRelayService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class CreateContainerPortAccessUrlUseCase implements IUseCase<
    CreateContainerPortAccessUrlInputDTO,
    CreateContainerPortAccessUrlOutputDTO
> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerOwnershipService) private readonly ownershipService: IContainerOwnershipService,
        @inject(CONTAINER_TOKENS.ContainerAccessiblePortResolver) private readonly accessiblePortResolver: IContainerAccessiblePortResolver,
        @inject(CONTAINER_TOKENS.ContainerPortProxyRelayService) private readonly relayService: IContainerPortProxyRelayService
    ) {}

    async execute(input: CreateContainerPortAccessUrlInputDTO): Promise<Result<CreateContainerPortAccessUrlOutputDTO>> {
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

        if (!port.public) {
            return Result.fail(ApplicationError.conflict(
                'Container::PublicPortUnavailable',
                'Container port has no public port assigned'
            ));
        }

        if (!container.teamCluster || !container.internalIp) {
            return Result.fail(ApplicationError.conflict(
                'Container::PortUnavailable',
                'Container networking is not ready yet'
            ));
        }

        const accessUrl = await this.relayService.createAccessUrl({
            teamId: input.teamId,
            containerId: container._id,
            userId: input.userId,
            teamClusterId: container.teamCluster,
            internalIp: container.internalIp,
            privatePort: input.privatePort,
            publicPort: port.public
        });

        return Result.ok({
            url: accessUrl.url,
            expiresAt: accessUrl.expiresAt,
            port
        });
    }
}
