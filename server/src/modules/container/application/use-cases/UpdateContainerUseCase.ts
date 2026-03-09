import { UpdateContainerInputDTO, UpdateContainerOutputDTO } from '@modules/container/application/dtos/UpdateContainerDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { ContainerEnvironmentVariable, ContainerPortMapping } from '@modules/container/domain/port/IContainerService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';

@injectable()
export class UpdateContainerUseCase implements IUseCase<UpdateContainerInputDTO, UpdateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    async execute(input: UpdateContainerInputDTO): Promise<Result<UpdateContainerOutputDTO>> {
        const { containerId, teamId, action, env, ports } = input;

        const container = await this.ownershipService.getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        if (action) {
            if (action === 'start') {
                const runtimeContainer = await this.containerRuntimeService.startContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            } else if (action === 'stop') {
                const runtimeContainer = await this.containerRuntimeService.stopContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'exited';
            } else if (action === 'restart') {
                const runtimeContainer = await this.containerRuntimeService.restartContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            }

            await this.repository.updateById(containerId, { status: container.status });

            return Result.ok({ container, status: container.status });
        }

        const effectivePorts = ports || container.ports;
        const effectiveEnv = env || container.env;

        const updated = await this.repository.updateById(containerId, {
            env: effectiveEnv,
            ports: effectivePorts
        });

        return Result.ok({ container: updated });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
};
