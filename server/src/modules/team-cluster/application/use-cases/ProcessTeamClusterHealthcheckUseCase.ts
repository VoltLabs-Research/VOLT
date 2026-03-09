import {
    ProcessTeamClusterHealthcheckInputDTO,
    ProcessTeamClusterHealthcheckOutputDTO
} from '@modules/team-cluster/application/dtos/ProcessTeamClusterHealthcheckDTO';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class ProcessTeamClusterHealthcheckUseCase implements IUseCase<
    ProcessTeamClusterHealthcheckInputDTO,
    ProcessTeamClusterHealthcheckOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    async execute(input: ProcessTeamClusterHealthcheckInputDTO): Promise<Result<ProcessTeamClusterHealthcheckOutputDTO, ApplicationError>> {
        try {
            const result = await this.teamClusterLifecycleService.processHealthcheck(
                input.teamClusterId,
                input.enrollmentToken,
                input.installedVersion
            );

            return Result.ok(result);
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to process team cluster healthcheck'));
        }
    }
};
