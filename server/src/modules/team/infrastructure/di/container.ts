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
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';
import type { ClassProvider } from 'tsyringe';
import { container } from 'tsyringe';

const TEAM_AI_TOOL_CLASSES: ClassProvider<unknown>[] = [
    { useClass: ListTeamMembersAITool },
    { useClass: ListTeamRolesAITool },
    { useClass: ListPendingInvitationsAITool },
    { useClass: ListSecretKeysAITool },
    { useClass: CreateTeamRoleAITool },
    { useClass: UpdateTeamRoleAITool },
    { useClass: DeleteTeamRoleAITool },
    { useClass: SendTeamInvitationAITool },
    { useClass: DeleteTeamInvitationAITool },
    { useClass: RemoveTeamMemberAITool },
    { useClass: UpdateTeamMemberAITool },
    { useClass: CreateSecretKeyAITool },
    { useClass: RevokeSecretKeyAITool },
    { useClass: DeleteSecretKeyAITool }
];

export const registerTeamDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [TEAM_TOKENS.TeamMemberRepository, TeamMemberRepository],
            [TEAM_TOKENS.TeamRepository, TeamRepository],
            [TEAM_TOKENS.TeamRoleRepository, TeamRoleRepository],
            [TEAM_TOKENS.TeamInvitationRepository, TeamInvitationRepository],
            [TEAM_TOKENS.SecretKeyRepository, SecretKeyRepository],
            [TEAM_TOKENS.SecretKeyUsageLogRepository, SecretKeyUsageLogRepository],
            [TEAM_TOKENS.TeamAIIntegrationRepository, TeamAIIntegrationRepository],
            [TEAM_TOKENS.TeamJobsService, TeamJobsService],
            [TEAM_TOKENS.TeamPresenceService, TeamPresenceService],
            [TEAM_TOKENS.TeamJobsSocketModule, TeamJobsSocketModule],
            [TEAM_TOKENS.TeamPresenceSocketModule, TeamPresenceSocketModule],
            [TEAM_TOKENS.TeamAIProviderCatalog, TeamAIProviderCatalog],
            [TEAM_TOKENS.TeamAIIntegrationInputService, TeamAIIntegrationInputService],
            [TEAM_TOKENS.TeamAIIntegrationSecretCipher, TeamAIIntegrationSecretCipher],
            [TEAM_TOKENS.TeamAIIntegrationSecretService, TeamAIIntegrationSecretService],
            [TEAM_TOKENS.TeamAIIntegrationSerializer, TeamAIIntegrationSerializer],
            [TEAM_TOKENS.SecretKeyUsageMetricsMapper, SecretKeyUsageMetricsMapper],
            [TEAM_TOKENS.TeamMembershipService, TeamMembershipService]
        ],
        aliases: [
            [SOCKET_TOKENS.SocketModule, TEAM_TOKENS.TeamJobsSocketModule],
            [SOCKET_TOKENS.SocketModule, TEAM_TOKENS.TeamPresenceSocketModule]
        ]
    });

    for (const toolClassProvider of TEAM_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider);
    }
};
