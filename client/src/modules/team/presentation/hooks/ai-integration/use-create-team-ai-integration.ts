import { useCallback } from 'react';
import useAIIntegrationUseCases from './use-ai-integration-repository';
import type { TeamAIProvider } from '@/modules/team/domain/entities/TeamAIIntegration';
import type { CreateTeamAIIntegrationParams } from '@/modules/team/domain/port/ITeamAIIntegrationRepository';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

const useCreateTeamAIIntegration = () => {
    const { teamAIIntegrationRepository } = useAIIntegrationUseCases();
    const requireSelectedTeamId = useRequiredSelectedTeamId();

    return useCallback(async (provider: TeamAIProvider, data: CreateTeamAIIntegrationParams) => {
        return await teamAIIntegrationRepository.createByProvider(requireSelectedTeamId(), provider, data);
    }, [requireSelectedTeamId, teamAIIntegrationRepository]);
};

export default useCreateTeamAIIntegration;
