import { addChatToCache } from '../../hooks/chat/queries';
import { runHandledAction } from '@/shared/errors/handled-action';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import type { Chat } from '../../api/entities/chat';
import type { GetOrCreateChatInputDTO } from '../../api/dtos/chat';

interface SocketLike {
    emit: (event: string, payload?: unknown) => unknown;
};

interface ChatActionDependencies {
    queryClient: QueryClient;
    socket: SocketLike;
    navigate: NavigateFunction;
};

export const getOrCreateChatAction = async (
    dependencies: ChatActionDependencies,
    getOrCreateChatMutation: (input: GetOrCreateChatInputDTO) => Promise<Chat>,
    teamId: string,
    participantId: string
) => {
    const { queryClient, navigate } = dependencies;

    return await runHandledAction({
        action: () => getOrCreateChatMutation({ teamId, participantId }),
        toast: createPromiseToastOptions({
            loading: 'Opening chat...',
            success: 'Chat ready',
            error: 'Failed to open chat'
        }),
        afterSuccess: (chat) => {
            addChatToCache(queryClient, chat);
            navigate(`/dashboard/messages/${chat._id}`);
        },
        rethrow: false
    });
};
