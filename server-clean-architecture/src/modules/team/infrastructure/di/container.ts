import { container } from 'tsyringe';
import { TEAM_TOKENS } from './TeamTokens';
import TeamRepository from '../persistence/mongo/repositories/TeamRepository';
import TeamMemberRepository from '../persistence/mongo/repositories/TeamMemberRepository';
import TeamRoleRepository from '../persistence/mongo/repositories/TeamRoleRepository';
import TeamInvitationRepository from '../persistence/mongo/repositories/TeamInvitationRepository';
import TeamJobsService from '../socket/TeamJobsService';
import TeamJobsSocketModule from '../socket/TeamJobsSocketModule';
// import TeamPresenceService from '../presence/TeamPresenceService';

export const registerTeamDependencies = () => {
    container.registerSingleton(TEAM_TOKENS.TeamRepository, TeamRepository);
    container.registerSingleton(TEAM_TOKENS.TeamMemberRepository, TeamMemberRepository);
    container.registerSingleton(TEAM_TOKENS.TeamRoleRepository, TeamRoleRepository);
    container.registerSingleton(TEAM_TOKENS.TeamInvitationRepository, TeamInvitationRepository);
    container.registerSingleton(TEAM_TOKENS.TeamJobsService, TeamJobsService);
    container.registerSingleton(TEAM_TOKENS.TeamJobsSocketModule, TeamJobsSocketModule);
    // container.registerSingleton(TEAM_TOKENS.TeamPresenceService, TeamPresenceService);
};
