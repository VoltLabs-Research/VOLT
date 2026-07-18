import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import type { ITeamClusterLifecycleService } from '@modules/cluster/ports/ITeamClusterLifecycleService';
import type { IDemoClusterDeploymentService } from '@modules/cluster/ports/IDemoClusterDeploymentService';
import {
    DeleteDemoTeamClusterInputDTO,
    DeleteDemoTeamClusterOutputDTO
} from '@modules/cluster/dtos/DemoTeamClusterDTO';
import { IUseCase } from '@shared/application/IUseCase';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class DeleteDemoTeamClusterUseCase implements IUseCase<DeleteDemoTeamClusterInputDTO, DeleteDemoTeamClusterOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService,
        @inject(CLUSTER_TOKENS.DemoClusterDeploymentService) private readonly demoClusterDeploymentService: IDemoClusterDeploymentService
    ){}

    async execute(input: DeleteDemoTeamClusterInputDTO): Promise<DeleteDemoTeamClusterOutputDTO> {
        const demo = await this.teamClusterRepository.findActiveDemoByTeamId(input.teamId);
        if (!demo) {
            return {
                teardownScheduled: false
            };
        }

        try {
            await this.teamClusterLifecycleService.markDeleting(demo.id);
        } catch (error: unknown) {
            logger.warn(`[DeleteDemoTeamClusterUseCase] markDeleting failed teamClusterId=${demo.id} error=${(error as Error).message}`);
        }

        const refreshed = await this.teamClusterRepository.findById(demo.id);
        const target = refreshed ?? demo;

        void (async () => {
            try {
                await this.demoClusterDeploymentService.teardownDemoStack(target);
                await this.teamClusterLifecycleService.deleteTeamCluster(target);
                logger.info(`[DeleteDemoTeamClusterUseCase] Demo deleted teamClusterId=${target.id} teamId=${input.teamId}`);
            } catch (error: unknown) {
                logger.error(error, `[DeleteDemoTeamClusterUseCase] Demo teardown failed teamClusterId=${target.id} teamId=${input.teamId}`);
            }
        })();

        return {
            teardownScheduled: true
        };
    }
}
