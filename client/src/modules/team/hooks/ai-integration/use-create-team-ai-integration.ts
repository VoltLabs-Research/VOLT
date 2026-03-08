import { useCreateTeamAIIntegrationMutation } from '@/modules/team/hooks/ai-integration/queries';
import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { CreateTeamAIIntegrationParams } from '@/modules/team/api/dtos/ai-integration/create-team-ai-integration';
import { useCallback } from 'react';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

export default function useCreateTeamAIIntegration() {
    const requireSelectedTeamId = useRequiredSelectedTeamId();
    const createMutation = useCreateTeamAIIntegrationMutation();

    return useCallback(async (provider: AIProvider, data: CreateTeamAIIntegrationParams) => {
        return await createMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            provider,
            ...data
        });
    }, [requireSelectedTeamId, createMutation]);
}
