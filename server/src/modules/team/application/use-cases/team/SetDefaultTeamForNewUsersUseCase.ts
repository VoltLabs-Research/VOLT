import type { IDeploymentSettingsRepository } from '@modules/system/domain/port/IDeploymentSettingsRepository';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import {
    SetDefaultTeamForNewUsersInputDTO,
    SetDefaultTeamForNewUsersOutputDTO
} from '@modules/team/application/dtos/team/SetDefaultTeamForNewUsersDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class SetDefaultTeamForNewUsersUseCase implements IUseCase<SetDefaultTeamForNewUsersInputDTO, SetDefaultTeamForNewUsersOutputDTO, ApplicationError> {
    constructor(
        @inject(SYSTEM_TOKENS.DeploymentSettingsRepository) private readonly deploymentSettingsRepository: IDeploymentSettingsRepository
    ) {}

    async execute(input: SetDefaultTeamForNewUsersInputDTO): Promise<Result<SetDefaultTeamForNewUsersOutputDTO, ApplicationError>> {
        const settings = await this.deploymentSettingsRepository.setDefaultTeam(
            input.enabled ? input.teamId : null,
            input.enabled
        );

        return Result.ok({
            defaultTeam: settings.props.defaultTeam,
            autoJoinNewMembers: settings.props.autoJoinNewMembers
        });
    }
}
