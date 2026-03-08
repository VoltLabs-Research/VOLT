import { useUpdateTeamAIIntegrationMutation } from '@/modules/team/hooks/ai-integration/queries';
import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { UpdateTeamAIIntegrationParams } from '@/modules/team/api/dtos/ai-integration/update-team-ai-integration';
import { useCallback } from 'react';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

export default function useUpdateTeamAIIntegration() {
    const requireSelectedTeamId = useRequiredSelectedTeamId();
    const updateMutation = useUpdateTeamAIIntegrationMutation();

    return useCallback(async (provider: AIProvider, data: UpdateTeamAIIntegrationParams) => {
        return await updateMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            provider,
            ...data
        });
    }, [requireSelectedTeamId, updateMutation]);
}
