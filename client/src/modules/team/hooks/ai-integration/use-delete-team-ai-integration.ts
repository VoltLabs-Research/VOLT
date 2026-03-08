import { useDeleteTeamAIIntegrationMutation } from '@/modules/team/hooks/ai-integration/queries';
import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import { useCallback } from 'react';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

export default function useDeleteTeamAIIntegration() {
    const requireSelectedTeamId = useRequiredSelectedTeamId();
    const deleteMutation = useDeleteTeamAIIntegrationMutation();

    return useCallback(async (provider: AIProvider) => {
        await deleteMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            provider
        });
    }, [requireSelectedTeamId, deleteMutation]);
}
