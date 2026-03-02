import { useCallback } from 'react';
import useAIIntegrationUseCases from './use-ai-integration-use-cases';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

const useListTeamAIIntegrationModels = () => {
    const { teamAIIntegrationRepository } = useAIIntegrationUseCases();
    const requireSelectedTeamId = useRequiredSelectedTeamId();

    return useCallback(async () => {
        return await teamAIIntegrationRepository.listModels(requireSelectedTeamId());
    }, [requireSelectedTeamId, teamAIIntegrationRepository]);
};

export default useListTeamAIIntegrationModels;
