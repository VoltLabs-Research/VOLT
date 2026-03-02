import { container } from 'tsyringe';
import { TEAM_TOKENS } from './tokens';
import TeamRepository from '../repositories/TeamRepository';
import TeamRoleRepository from '../repositories/TeamRoleRepository';
import TeamMemberRepository from '../repositories/TeamMemberRepository';
import TeamInvitationRepository from '../repositories/TeamInvitationRepository';
import SecretKeyRepository from '../repositories/SecretKeyRepository';
import TeamAIIntegrationRepository from '../repositories/TeamAIIntegrationRepository';
import TeamStorage from '../storage/TeamStorage';
import type ITeamRepository from '../../domain/ports/ITeamRepository';
import type ITeamRoleRepository from '../../domain/ports/ITeamRoleRepository';
import type ITeamMemberRepository from '../../domain/ports/ITeamMemberRepository';
import type ITeamInvitationRepository from '../../domain/ports/ITeamInvitationRepository';
import type ISecretKeyRepository from '../../domain/ports/ISecretKeyRepository';
import type ITeamAIIntegrationRepository from '../../domain/ports/ITeamAIIntegrationRepository';
import type ITeamStorage from '../../domain/ports/ITeamStorage';
import CreateTeamUseCase from '../../application/use-cases/team/CreateTeamUseCase';

export const ensureTeamDI = () => {
    container.register<ITeamStorage>(TEAM_TOKENS.TeamStorage, TeamStorage);

    container.register<ITeamRepository>(TEAM_TOKENS.TeamRepository, TeamRepository);
    container.register<ITeamRoleRepository>(TEAM_TOKENS.TeamRoleRepository, TeamRoleRepository);
    container.register<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository, TeamMemberRepository);
    container.register<ITeamInvitationRepository>(TEAM_TOKENS.TeamInvitationRepository, TeamInvitationRepository);
    container.register<ISecretKeyRepository>(TEAM_TOKENS.SecretKeyRepository, SecretKeyRepository);
    container.register<ITeamAIIntegrationRepository>(TEAM_TOKENS.TeamAIIntegrationRepository, TeamAIIntegrationRepository);

    container.register(TEAM_TOKENS.CreateTeamUseCase, CreateTeamUseCase);
};
