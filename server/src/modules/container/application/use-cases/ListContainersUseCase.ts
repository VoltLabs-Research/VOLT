import { USER_POPULATE, CLUSTER_POPULATE } from '@shared/application/PopulatePresets';
import { ListContainersInputDTO, ListContainersOutputDTO } from '@modules/container/application/dtos/ListContainersDTO';
import type { Container } from '@modules/container/domain/entities/Container';
import type { RuntimeContainerSummary } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';

interface ListContainersFilter extends Record<string, unknown> {
    team: string;
    folder?: string | null;
};

const getTeamClusterId = (teamCluster: unknown): string | null => {
    if (!teamCluster) {
        return null;
    }

    if (typeof teamCluster === 'string') {
        return teamCluster;
    }

    if (typeof teamCluster === 'object' && teamCluster !== null && '_id' in teamCluster) {
        const objectId = teamCluster._id;
        if (typeof objectId === 'string') {
            return objectId;
        }
    }

    return null;
};

@injectable()
export class ListContainersUseCase implements IUseCase<ListContainersInputDTO, ListContainersOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService
    ) {}

    async execute(input: ListContainersInputDTO): Promise<Result<ListContainersOutputDTO>> {
        const filter: ListContainersFilter = {
            team: input.teamId
        };

        if (input.folderId === 'root') {
            filter.folder = null;
        } else if (input.folderId) {
            filter.folder = input.folderId;
        }

        if (input.search) {
            filter.name = { $regex: input.search, $options: 'i' };
        }

        const result = await this.repository.findAll({
            filter,
            page: input.page,
            limit: input.limit,
            sort: { updatedAt: -1 },
            populate: [
                USER_POPULATE,
                CLUSTER_POPULATE
            ]
        });

        await this.syncRuntimeStatus(result.data);

        return Result.ok(result);
    }

    private async syncRuntimeStatus(containers: Container[]): Promise<void> {
        const runtimeIndex = new Map<string, RuntimeContainerSummary>();
        const teamClusterIds = Array.from(new Set(containers
            .map((container) => getTeamClusterId(container.teamCluster))
            .filter((teamClusterId): teamClusterId is string => typeof teamClusterId === 'string' && teamClusterId.length > 0)));

        await Promise.all(teamClusterIds.map(async (teamClusterId) => {
            try {
                const runtimeContainers = await this.containerRuntimeService.listContainers(teamClusterId);
                runtimeContainers.forEach((runtimeContainer) => {
                    runtimeIndex.set(`${teamClusterId}:${runtimeContainer.Id}`, runtimeContainer);
                });
            } catch {
            }
        }));

        containers.forEach((container) => {
            const teamClusterId = getTeamClusterId(container.teamCluster);
            if (!teamClusterId) {
                return;
            }

            const runtimeContainer = runtimeIndex.get(`${teamClusterId}:${container.containerId}`);
            if (runtimeContainer?.State) {
                container.status = runtimeContainer.State;
            }
        });
    }
};
