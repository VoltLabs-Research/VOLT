import { useCallback } from 'react';
import { useUpdateTeamAIIntegrationMutation } from '@/modules/team/hooks/ai-integration/queries';
import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';
import type { UpdateTeamAIIntegrationParams } from '@/modules/team/api/dtos/update-team-ai-integration';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

const useUpdateTeamAIIntegration = () => {
    const requireSelectedTeamId = useRequiredSelectedTeamId();
    const updateMutation = useUpdateTeamAIIntegrationMutation();

    return useCallback(async (provider: AIProvider, data: UpdateTeamAIIntegrationParams) => {
        return await updateMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            provider,
            ...data
        });
    }, [requireSelectedTeamId, updateMutation]);
};

export default useUpdateTeamAIIntegration;
