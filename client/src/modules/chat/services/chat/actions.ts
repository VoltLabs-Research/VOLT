import { addChatToCache } from '../../hooks/chat/queries';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import type { Chat } from '../../api/entities/chat';
import type { GetOrCreateChatInputDTO } from '../../api/dtos/chat';

interface ChatActionDependencies {
    queryClient: QueryClient;
    navigate: NavigateFunction;
}

export const getOrCreateChatAction = async (
    dependencies: ChatActionDependencies,
    getOrCreateChatMutation: (input: GetOrCreateChatInputDTO) => Promise<Chat>,
    teamId: string,
    participantId: string
) => {
    const { queryClient, navigate } = dependencies;

    return await runAction({
        action: () => getOrCreateChatMutation({ teamId, participantId }),
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
};
