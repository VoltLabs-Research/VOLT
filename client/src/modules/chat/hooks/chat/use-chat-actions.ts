import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetOrCreateChatMutation } from './queries';
import { getOrCreateChatAction } from '../../services/chat/actions';
import { useNavigate } from 'react-router-dom';
const useChatActions = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const getOrCreateChatMutationResult = useGetOrCreateChatMutation();

    const getOrCreateChat = useCallback(async (teamId: string, participantId: string) => {
        return getOrCreateChatAction(
            { queryClient, navigate },
            getOrCreateChatMutationResult.mutateAsync,
            teamId,
            participantId
        );
    }, [getOrCreateChatMutationResult, navigate, queryClient]);

    return {
        getOrCreateChat
    };
};

export default useChatActions;
