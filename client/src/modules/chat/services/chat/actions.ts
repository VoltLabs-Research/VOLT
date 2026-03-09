import { addChatToCache } from '../../hooks/chat/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import type { Chat } from '../../api/entities/chat';
import type { GetOrCreateChatInputDTO } from '../../api/dtos/chat';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';

interface SocketLike {
    emit: (event: string, payload?: unknown) => unknown;
};

interface ChatActionDependencies {
    queryClient: QueryClient;
    socket: SocketLike;
    navigate: NavigateFunction;
};

const swallowRBACError = (error: unknown) => {
    if (isAccessDeniedError(error)) {
        return;
    }

    throw error;
};

export const getOrCreateChatAction = async (
    dependencies: ChatActionDependencies,
    getOrCreateChatMutation: (input: GetOrCreateChatInputDTO) => Promise<Chat>,
    teamId: string,
    participantId: string
) => {
    const { queryClient, navigate } = dependencies;

    try {
        const chat = await showPromise(getOrCreateChatMutation({ teamId, participantId }), {
            loading: { title: 'Opening chat...' },
            success: { title: 'Chat ready' },
            error: { title: 'Failed to open chat' }
        });

        addChatToCache(queryClient, chat);
        navigate(`/dashboard/messages/${chat._id}`);

        return chat;
    } catch (error: unknown) {
        swallowRBACError(error);
    }
};
