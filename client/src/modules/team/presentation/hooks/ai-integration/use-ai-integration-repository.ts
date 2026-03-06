import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamAIIntegrationRepository from '@/modules/team/domain/port/ITeamAIIntegrationRepository';

const useAIIntegrationUseCases = () => {
    return {
        teamAIIntegrationRepository: useResolve<ITeamAIIntegrationRepository>(TEAM_TOKENS.TeamAIIntegrationRepository)
    };
};

export default useAIIntegrationUseCases;
