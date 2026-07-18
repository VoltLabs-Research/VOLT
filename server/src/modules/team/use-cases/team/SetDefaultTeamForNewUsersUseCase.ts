import {
    SetDefaultTeamForNewUsersInputDTO,
    SetDefaultTeamForNewUsersOutputDTO
} from '@modules/team/dtos/team/SetDefaultTeamForNewUsersDTO';
import type { IDeploymentSettingsRepository } from '@shared/contracts/ports';
import { SYSTEM_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class SetDefaultTeamForNewUsersUseCase implements IUseCase<SetDefaultTeamForNewUsersInputDTO, SetDefaultTeamForNewUsersOutputDTO> {
    constructor(
        @inject(SYSTEM_CONTRACT_TOKENS.DeploymentSettingsRepository) private readonly deploymentSettingsRepository: IDeploymentSettingsRepository
    ) {}

    async execute(input: SetDefaultTeamForNewUsersInputDTO): Promise<SetDefaultTeamForNewUsersOutputDTO> {
        const settings = await this.deploymentSettingsRepository.setDefaultTeam(
            input.enabled ? input.teamId : null,
            input.enabled
        );

        return {
            defaultTeam: settings.props.defaultTeam,
            autoJoinNewMembers: settings.props.autoJoinNewMembers
        };
    }
}
