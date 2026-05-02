import {
    ProcessTeamClusterHealthcheckInputDTO,
    ProcessTeamClusterHealthcheckOutputDTO
} from '@modules/cluster/application/dtos/ProcessTeamClusterHealthcheckDTO';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class ProcessTeamClusterHealthcheckUseCase implements IUseCase<
    ProcessTeamClusterHealthcheckInputDTO,
    ProcessTeamClusterHealthcheckOutputDTO,
    ApplicationError
> {
    constructor(
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
