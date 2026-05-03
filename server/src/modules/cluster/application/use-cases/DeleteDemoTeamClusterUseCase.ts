import {
    DeleteDemoTeamClusterInputDTO,
    DeleteDemoTeamClusterOutputDTO
} from '@modules/cluster/application/dtos/DemoTeamClusterDTO';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import DemoClusterDeploymentService from '@modules/cluster/infrastructure/services/DemoClusterDeploymentService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { injectable } from 'tsyringe';

@injectable()
export default class DeleteDemoTeamClusterUseCase implements IUseCase<DeleteDemoTeamClusterInputDTO, DeleteDemoTeamClusterOutputDTO, ApplicationError> {
    constructor(
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,
        private readonly demoClusterDeploymentService: DemoClusterDeploymentService
    ){}

    async execute(input: DeleteDemoTeamClusterInputDTO): Promise<Result<DeleteDemoTeamClusterOutputDTO, ApplicationError>> {
        const demo = await this.teamClusterRepository.findActiveDemoByTeamId(input.teamId);
        if (!demo) {
            return Result.ok({
                teardownScheduled: false
            });
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

        return Result.ok({
            teardownScheduled: true
        });
    }
}
