import { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import service from '@/modules/ai/api/service';
import { conversationsQuery, forgetMessages, invalidateConversations } from '@/modules/ai/hooks/queries';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { showPromise } from '@/shared/ui/hooks/toast';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';

const TITLE_LENGTH = 80;

const titleOf = (text: string): string => {
    const line = text.trim().split('\n')[0] ?? '';
    return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
};

const useConversations = () => {
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const queueTurn = useChatSurfaceStore((state) => state.queueTurn);
    const list = conversationsQuery(teamId ?? '', { enabled: Boolean(teamId) });

    const create = useMutation({
        mutationFn: (title: string) => service.createConversation({
            teamId: teamId ?? '',
            title
        }),
        onSuccess: () => invalidateConversations()
    });

    const rename = useMutation({
        mutationFn: (input: { conversation: AIConversation; title: string }) => service.updateConversation({
            teamId: input.conversation.teamId,
            conversationId: input.conversation._id,
            title: input.title
        }),
        onSuccess: () => invalidateConversations()
    });

    const remove = useMutation({
        mutationFn: (conversation: AIConversation) => service.deleteConversation({
            teamId: conversation.teamId,
            conversationId: conversation._id
        }),
        onSuccess: (_, conversation) => {
            forgetMessages(conversation._id);
            return invalidateConversations();
        }
    });

    // Creates the conversation and leaves its first message queued for the session that opens it,
    // which sends it once it has joined: the socket refuses a turn for a conversation not joined.
    const start = useCallback(async (text: string): Promise<AIConversation | null> => {
        if (!teamId || text.trim() === '') return null;

        try {
            const conversation = await create.mutateAsync(titleOf(text));
            queueTurn({
                conversationId: conversation._id,
                text
            });
            return conversation;
        } catch (error: unknown) {
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to start the conversation'
            });
            return null;
        }
    }, [create, queueTurn, teamId]);

    const renameConversation = useCallback(async (conversation: AIConversation, title: string): Promise<void> => {
        const normalized = title.trim();
        if (!normalized || normalized === conversation.title) return;

        try {
            await rename.mutateAsync({
                conversation,
                title: normalized
            });
        } catch (error: unknown) {
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to rename the conversation'
            });
        }
    }, [rename]);

    const deleteConversation = useCallback(async (conversation: AIConversation): Promise<void> => {
        await showPromise(remove.mutateAsync(conversation), {
            loading: { title: 'Deleting conversation...' },
            success: { title: 'Conversation deleted' },
            error: { title: 'Failed to delete conversation' }
        });
    }, [remove]);

    return {
        teamId,
        conversations: list.data?.data ?? [],
        isLoading: list.isLoading,
        error: list.error,
        reload: list.refetch,
        canCreate: canAccess(['ai-conversation:create']),
        canUpdate: canAccess(['ai-conversation:update']),
        canDelete: canAccess(['ai-conversation:delete']),
        isStarting: create.isPending,
        start,
        renameConversation,
        deleteConversation
    };
};

export default useConversations;
