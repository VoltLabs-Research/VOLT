import { GetContainerStatsInputDTO, GetContainerStatsOutputDTO } from '@modules/container/application/dtos/GetContainerStatsDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/services/ContainerOwnershipService';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetContainerStatsUseCase implements IUseCase<GetContainerStatsInputDTO, GetContainerStatsOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: GetContainerStatsInputDTO): Promise<Result<GetContainerStatsOutputDTO>> {
        const container = await this.ownershipService.getOwnedByTeam(input.containerId, input.teamId);

        const stats = await this.containerService.getStats(container.containerId);

        return Result.ok({
            stats,
            limits: {
                memory: container.memory * 1024 * 1024,
                cpus: container.cpus
            }
        });
    }
};
