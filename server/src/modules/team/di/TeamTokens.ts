import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';

export const TEAM_TOKENS = Object.freeze({
    TeamHttpService: Symbol.for('TeamHttpService'),
    TeamMemberHttpService: Symbol.for('TeamMemberHttpService'),
    TeamRoleHttpService: Symbol.for('TeamRoleHttpService'),
    TeamInvitationHttpService: Symbol.for('TeamInvitationHttpService'),
    SecretKeyHttpService: Symbol.for('SecretKeyHttpService'),
    TeamAIIntegrationHttpService: Symbol.for('TeamAIIntegrationHttpService'),
    TeamRepository: TEAM_CONTRACT_TOKENS.TeamRepository,
    TeamMemberRepository: TEAM_CONTRACT_TOKENS.TeamMemberRepository,
    TeamRoleRepository: Symbol.for('TeamRoleRepository'),
    TeamInvitationRepository: Symbol.for('TeamInvitationRepository'),
    SecretKeyRepository: TEAM_CONTRACT_TOKENS.SecretKeyRepository,
    SecretKeyUsageLogRepository: TEAM_CONTRACT_TOKENS.SecretKeyUsageLogRepository,
    TeamAIIntegrationRepository: Symbol.for('TeamAIIntegrationRepository'),
    TeamAIProviderCatalog: Symbol.for('TeamAIProviderCatalog'),
    SecretKeyUsageMetricsMapper: Symbol.for('SecretKeyUsageMetricsMapper'),
    TeamMembershipService: Symbol.for('TeamMembershipService'),
    TeamRoomPresenceService: Symbol.for('TeamRoomPresenceService'),
    DefaultTeamEnroller: TEAM_CONTRACT_TOKENS.DefaultTeamEnroller
});
