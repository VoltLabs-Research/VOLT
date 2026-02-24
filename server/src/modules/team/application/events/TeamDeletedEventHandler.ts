import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';
import type { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import type { ITeamInvitationRepository } from '@modules/team/domain/ports/ITeamInvitationRepository';
import type { ISecretKeyRepository } from '@modules/team/domain/ports/ISecretKeyRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository,

        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;
        const query = { team: teamId };

        await Promise.all([
            this.teamRoleRepository.deleteMany(query),
            this.teamMemberRepository.deleteMany(query),
            this.teamInvitationRepository.deleteMany(query),
            this.secretKeyRepository.deleteMany(query)
        ]);
    }
};
