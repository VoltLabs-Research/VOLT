import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import type { ITeamClusterLifecycleService } from '@modules/cluster/domain/port/ITeamClusterLifecycleService';
import type { IDemoClusterDeploymentService } from '@modules/cluster/domain/port/IDemoClusterDeploymentService';
import {
    GetDemoTeamClusterStatusInputDTO,
    GetDemoTeamClusterStatusOutputDTO
} from '@modules/cluster/application/dtos/DemoTeamClusterDTO';
import { toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class GetDemoTeamClusterStatusUseCase implements IUseCase<GetDemoTeamClusterStatusInputDTO, GetDemoTeamClusterStatusOutputDTO, ApplicationError> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService,
        @inject(CLUSTER_TOKENS.DemoClusterDeploymentService) private readonly demoClusterDeploymentService: IDemoClusterDeploymentService
    ){}

    async execute(input: GetDemoTeamClusterStatusInputDTO): Promise<Result<GetDemoTeamClusterStatusOutputDTO, ApplicationError>> {
        const demo = await this.teamClusterRepository.findActiveDemoByTeamId(input.teamId);
        if (!demo) {
            return Result.ok({
                teamCluster: null,
                remainingMs: null,
                hasActiveDemo: false
            });
        }

        const expiresAt = demo.props.demoExpiresAt;
        if (!expiresAt) {
            return Result.ok({
                teamCluster: toTeamClusterDTO(demo),
                remainingMs: null,
                hasActiveDemo: true
            });
        }

        const now = Date.now();
        const remainingMs = expiresAt.getTime() - now;

        if (remainingMs <= 0) {
            void this.scheduleExpiredDemoCleanup(demo.id, input.teamId);

            return Result.ok({
                teamCluster: toTeamClusterDTO(demo),
                remainingMs: 0,
                hasActiveDemo: false
            });
        }

        return Result.ok({
            teamCluster: toTeamClusterDTO(demo),
            remainingMs,
            hasActiveDemo: true
        });
    }

    private async scheduleExpiredDemoCleanup(teamClusterId: string, teamId: string): Promise<void> {
        try {
            await this.teamClusterLifecycleService.markDeleting(teamClusterId);
        } catch (error: unknown) {
            logger.warn(`[GetDemoTeamClusterStatusUseCase] markDeleting failed teamClusterId=${teamClusterId} error=${(error as Error).message}`);
        }

        const teamCluster = await this.teamClusterRepository.findById(teamClusterId);
        if (!teamCluster) {
            return;
        }

        try {
            await this.demoClusterDeploymentService.teardownDemoStack(teamCluster);
            await this.teamClusterLifecycleService.deleteTeamCluster(teamCluster);
            logger.info(`[GetDemoTeamClusterStatusUseCase] Expired demo cleaned up teamClusterId=${teamClusterId} teamId=${teamId}`);
        } catch (error: unknown) {
            logger.error(error, `[GetDemoTeamClusterStatusUseCase] Expired demo cleanup failed teamClusterId=${teamClusterId} teamId=${teamId}`);
        }
    }
}
