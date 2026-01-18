import { container } from 'tsyringe';
import { TEAM_TOKENS } from './TeamTokens';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamRepository';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamRoleRepository';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamInvitationRepository';
import TeamJobsService from '@modules/team/infrastructure/socket/TeamJobsService';
import TeamJobsSocketModule from '@modules/team/infrastructure/socket/TeamJobsSocketModule';
// import TeamPresenceService from '@modules/team/infrastructure/presence/TeamPresenceService';

export const registerTeamDependencies = () => {
    container.registerSingleton(TEAM_TOKENS.TeamRepository, TeamRepository);
    container.registerSingleton(TEAM_TOKENS.TeamMemberRepository, TeamMemberRepository);
    container.registerSingleton(TEAM_TOKENS.TeamRoleRepository, TeamRoleRepository);
    container.registerSingleton(TEAM_TOKENS.TeamInvitationRepository, TeamInvitationRepository);
    container.registerSingleton(TEAM_TOKENS.TeamJobsService, TeamJobsService);
    container.registerSingleton(TEAM_TOKENS.TeamJobsSocketModule, TeamJobsSocketModule);
    // container.registerSingleton(TEAM_TOKENS.TeamPresenceService, TeamPresenceService);
};
