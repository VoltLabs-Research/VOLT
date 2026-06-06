import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetOrCreateChatMutation, addChatToCache } from './queries';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { useNavigate } from 'react-router-dom';

const useChatActions = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const getOrCreateChatMutationResult = useGetOrCreateChatMutation();

    const getOrCreateChat = useCallback(async (teamId: string, participantId: string) => {
        return runAction({
            action: () => getOrCreateChatMutationResult.mutateAsync({ teamId, participantId }),
            toast: createPromiseToastOptions({
                loading: 'Opening chat...',
                success: 'Chat ready',
                error: 'Failed to open chat'
            }),
            afterSuccess: (chat) => {
                addChatToCache(queryClient, chat);
                navigate(`/dashboard/messages/${chat._id}`);
            }
        });
    }, [getOrCreateChatMutationResult, navigate, queryClient]);

    return {
        getOrCreateChat
    };
};

export default useChatActions;
