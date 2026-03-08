import { useCallback } from 'react';
import { useCreateTeamAIIntegrationMutation } from '@/modules/team/hooks/ai-integration/queries';
import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';
import type { CreateTeamAIIntegrationParams } from '@/modules/team/api/dtos/create-team-ai-integration';
import useRequiredSelectedTeamId from './use-required-selected-team-id';

const useCreateTeamAIIntegration = () => {
    const requireSelectedTeamId = useRequiredSelectedTeamId();
    const createMutation = useCreateTeamAIIntegrationMutation();

    return useCallback(async (provider: AIProvider, data: CreateTeamAIIntegrationParams) => {
        return await createMutation.mutateAsync({
            teamId: requireSelectedTeamId(),
            provider,
            ...data
        });
    }, [requireSelectedTeamId, createMutation]);
};

export default useCreateTeamAIIntegration;
