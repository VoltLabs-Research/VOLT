import { container } from 'tsyringe';
import { TEAM_TOKENS } from './TeamTokens';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamRepository';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamRoleRepository';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamInvitationRepository';
import SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/SecretKeyRepository';
import SecretKeyUsageLogRepository from '@modules/team/infrastructure/persistence/mongo/repositories/SecretKeyUsageLogRepository';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/TeamAIIntegrationRepository';
import TeamJobsService from '@modules/team/infrastructure/socket/TeamJobsService';
import TeamJobsSocketModule from '@modules/team/infrastructure/socket/TeamJobsSocketModule';
import TeamAIProviderCatalog from '@modules/team/application/services/TeamAIProviderCatalog';
import TeamAIIntegrationInputService from '@modules/team/application/services/TeamAIIntegrationInputService';
import TeamAIIntegrationSerializer from '@modules/team/application/services/TeamAIIntegrationSerializer';
import TeamPresenceService from '@modules/team/application/services/TeamPresenceService';

import * as teamAiTools from '@modules/team/application/ai-tools';

export const registerTeamDependencies = () => {
    // Register TeamMemberRepository FIRST - TeamRepository depends on it
    container.registerSingleton(TEAM_TOKENS.TeamMemberRepository, TeamMemberRepository);
    container.registerSingleton(TEAM_TOKENS.TeamRepository, TeamRepository);
    container.registerSingleton(TEAM_TOKENS.TeamRoleRepository, TeamRoleRepository);
    container.registerSingleton(TEAM_TOKENS.TeamInvitationRepository, TeamInvitationRepository);
    container.registerSingleton(TEAM_TOKENS.SecretKeyRepository, SecretKeyRepository);
    container.registerSingleton(TEAM_TOKENS.SecretKeyUsageLogRepository, SecretKeyUsageLogRepository);
    container.registerSingleton(TEAM_TOKENS.TeamAIIntegrationRepository, TeamAIIntegrationRepository);
    container.registerSingleton(TEAM_TOKENS.TeamJobsService, TeamJobsService);
    container.registerSingleton(TEAM_TOKENS.TeamPresenceService, TeamPresenceService);
    container.registerSingleton(TEAM_TOKENS.TeamJobsSocketModule, TeamJobsSocketModule);
    container.registerSingleton(TEAM_TOKENS.TeamAIProviderCatalog, TeamAIProviderCatalog);
    container.registerSingleton(TEAM_TOKENS.TeamAIIntegrationInputService, TeamAIIntegrationInputService);
    container.registerSingleton(TEAM_TOKENS.TeamAIIntegrationSerializer, TeamAIIntegrationSerializer);

    // Register all AI Tools for discovery
    for (const ToolClass of Object.values(teamAiTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
