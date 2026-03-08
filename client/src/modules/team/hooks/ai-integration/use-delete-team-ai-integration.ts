import { useCallback } from 'react';
import { useDeleteTeamAIIntegrationMutation } from '@/modules/team/hooks/ai-integration/queries';
import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

const useDeleteTeamAIIntegration = () => {
    const requireSelectedTeamId = useRequiredSelectedTeamId();
    const deleteMutation = useDeleteTeamAIIntegrationMutation();

    return useCallback(async (provider: AIProvider) => {
        await deleteMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            provider
        });
    }, [requireSelectedTeamId, deleteMutation]);
};

export default useDeleteTeamAIIntegration;
