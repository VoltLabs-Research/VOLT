import { useCallback } from 'react';
import useAIIntegrationUseCases from './use-ai-integration-repository';
import type { TeamAIProvider } from '@/modules/team/domain/entities/TeamAIIntegration';
import type { UpdateTeamAIIntegrationParams } from '@/modules/team/domain/port/ITeamAIIntegrationRepository';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

const useUpdateTeamAIIntegration = () => {
    const { teamAIIntegrationRepository } = useAIIntegrationUseCases();
    const requireSelectedTeamId = useRequiredSelectedTeamId();

    return useCallback(async (provider: TeamAIProvider, data: UpdateTeamAIIntegrationParams) => {
        return await teamAIIntegrationRepository.updateByProvider(requireSelectedTeamId(), provider, data);
    }, [requireSelectedTeamId, teamAIIntegrationRepository]);
};

export default useUpdateTeamAIIntegration;
