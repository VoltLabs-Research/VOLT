import { TEAM_TOKENS } from './TeamTokens';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SecretKeyUsageMetricsMapper from '@modules/team/infrastructure/services/secret-key/SecretKeyUsageMetricsMapper';
import TeamAIIntegrationInputService from '@modules/team/infrastructure/services/ai-integration/TeamAIIntegrationInputService';
import TeamAIIntegrationSecretService from '@modules/team/infrastructure/services/ai-integration/TeamAIIntegrationSecretService';
import TeamAIIntegrationSerializer from '@modules/team/infrastructure/services/ai-integration/TeamAIIntegrationSerializer';
import TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';
import TeamMembershipService from '@modules/team/infrastructure/services/team/TeamMembershipService';
import TeamPresenceService from '@modules/team/infrastructure/services/team-member/TeamPresenceService';
import {
    CreateSecretKeyAITool,
    CreateTeamRoleAITool,
    DeleteSecretKeyAITool,
    DeleteTeamInvitationAITool,
    DeleteTeamRoleAITool,
    ListPendingInvitationsAITool,
    ListSecretKeysAITool,
    ListTeamMembersAITool,
    ListTeamRolesAITool,
    RemoveTeamMemberAITool,
    RevokeSecretKeyAITool,
    SendTeamInvitationAITool,
    UpdateTeamMemberAITool,
    UpdateTeamRoleAITool
} from '@modules/team/application/ai-tools';
import DiscoverTeamAIProviderModelsUseCase from '@modules/team/application/use-cases/ai-integration/DiscoverTeamAIProviderModelsUseCase';
import SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import SecretKeyUsageLogRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyUsageLogRepository';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import TeamJobsService from '@modules/team/socket/team/TeamJobsService';
import TeamAIIntegrationSecretCipher from '@modules/team/infrastructure/security/ai-integration/TeamAIIntegrationSecretCipher';
import TeamJobsSocketModule from '@modules/team/socket/team/TeamJobsSocketModule';
import TeamPresenceSocketModule from '@modules/team/socket/team-member/TeamPresenceSocketModule';
import { container } from 'tsyringe';
import type { AITool } from '@shared/application/ai/AITool';

type AIToolConstructor = new (...args: any[]) => AITool<any, unknown, any>;

const TEAM_AI_TOOL_CLASSES: AIToolConstructor[] = [
    ListTeamMembersAITool,
    ListTeamRolesAITool,
    ListPendingInvitationsAITool,
    ListSecretKeysAITool,
    CreateTeamRoleAITool,
    UpdateTeamRoleAITool,
    DeleteTeamRoleAITool,
    SendTeamInvitationAITool,
    DeleteTeamInvitationAITool,
    RemoveTeamMemberAITool,
    UpdateTeamMemberAITool,
    CreateSecretKeyAITool,
    RevokeSecretKeyAITool,
    DeleteSecretKeyAITool
];

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

    for (const ToolClass of TEAM_AI_TOOL_CLASSES) {
        container.registerSingleton<AITool>(AI_TOKENS.AITool, ToolClass);
    }
};
