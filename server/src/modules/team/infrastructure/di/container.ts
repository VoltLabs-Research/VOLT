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
import TeamAIIntegrationSecretService from '@modules/team/application/services/TeamAIIntegrationSecretService';
import TeamAIIntegrationSerializer from '@modules/team/application/services/TeamAIIntegrationSerializer';
import SecretKeyUsageMetricsMapper from '@modules/team/application/services/SecretKeyUsageMetricsMapper';
import TeamMembershipService from '@modules/team/application/services/TeamMembershipService';
import TeamPresenceService from '@modules/team/application/services/TeamPresenceService';
import TeamPresenceSocketModule from '@modules/team/infrastructure/socket/TeamPresenceSocketModule';
import TeamAIIntegrationSecretCipher from '@modules/team/infrastructure/security/TeamAIIntegrationSecretCipher';
import DiscoverTeamAIProviderModelsUseCase from '@modules/team/application/use-cases/ai-integration/DiscoverTeamAIProviderModelsUseCase';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { AITool } from '@shared/application/ai/AITool';

import * as teamAiTools from '@modules/team/application/ai-tools';

type AIToolConstructor = new (...args: any[]) => AITool;

export const registerTeamDependencies = () => {
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
    container.registerSingleton(TEAM_TOKENS.TeamPresenceSocketModule, TeamPresenceSocketModule);
    container.registerSingleton(TEAM_TOKENS.TeamAIProviderCatalog, TeamAIProviderCatalog);
    container.registerSingleton(TEAM_TOKENS.TeamAIIntegrationInputService, TeamAIIntegrationInputService);
    container.registerSingleton(TEAM_TOKENS.TeamAIIntegrationSecretCipher, TeamAIIntegrationSecretCipher);
    container.registerSingleton(TEAM_TOKENS.TeamAIIntegrationSecretService, TeamAIIntegrationSecretService);
    container.registerSingleton(TEAM_TOKENS.TeamAIIntegrationSerializer, TeamAIIntegrationSerializer);
    container.registerSingleton(TEAM_TOKENS.SecretKeyUsageMetricsMapper, SecretKeyUsageMetricsMapper);
    container.registerSingleton(TEAM_TOKENS.TeamMembershipService, TeamMembershipService);
    container.register(TEAM_TOKENS.DiscoverTeamAIProviderModelsUseCase, DiscoverTeamAIProviderModelsUseCase);

    container.register(SOCKET_TOKENS.SocketModule, { useToken: TEAM_TOKENS.TeamJobsSocketModule });
    container.register(SOCKET_TOKENS.SocketModule, { useToken: TEAM_TOKENS.TeamPresenceSocketModule });

    const toolClasses = Object.values(teamAiTools) as AIToolConstructor[];
    for (const ToolClass of toolClasses) {
        container.registerSingleton(AI_TOKENS.AITool as any, ToolClass as any);
    }
};
