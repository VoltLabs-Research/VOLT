import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamAIIntegrationRepository from '@/modules/team/domain/port/ITeamAIIntegrationRepository';

const useAIIntegrationUseCases = () => {
    return useMemo(() => ({
        teamAIIntegrationRepository: container.resolve<ITeamAIIntegrationRepository>(TEAM_TOKENS.TeamAIIntegrationRepository)
    }), []);
};

export default useAIIntegrationUseCases;
