import {
    ProcessTeamClusterHealthcheckInputDTO,
    ProcessTeamClusterHealthcheckOutputDTO
} from '@modules/cluster/dtos/ProcessTeamClusterHealthcheckDTO';
import type { ITeamClusterLifecycleService } from '@modules/cluster/ports/ITeamClusterLifecycleService';
import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class ProcessTeamClusterHealthcheckUseCase implements IUseCase<ProcessTeamClusterHealthcheckInputDTO, ProcessTeamClusterHealthcheckOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService
    ){}

    async execute(input: ProcessTeamClusterHealthcheckInputDTO): Promise<ProcessTeamClusterHealthcheckOutputDTO> {
        try {
            const result = await this.teamClusterLifecycleService.processHealthcheck(
                input.teamClusterId,
                input.enrollmentToken,
                input.installedVersion
            );

            return result;
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process team cluster healthcheck');
        }
    }
};
