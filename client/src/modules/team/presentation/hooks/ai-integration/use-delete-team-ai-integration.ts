import { useCallback } from 'react';
import useAIIntegrationUseCases from './use-ai-integration-use-cases';
import type { TeamAIProvider } from '@/modules/team/domain/entities/TeamAIIntegration';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

const useDeleteTeamAIIntegration = () => {
    const { teamAIIntegrationRepository } = useAIIntegrationUseCases();
    const requireSelectedTeamId = useRequiredSelectedTeamId();

    return useCallback(async (provider: TeamAIProvider) => {
        await teamAIIntegrationRepository.deleteByProvider(requireSelectedTeamId(), provider);
    }, [requireSelectedTeamId, teamAIIntegrationRepository]);
};

export default useDeleteTeamAIIntegration;
