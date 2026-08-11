import { conversationQuery, invalidateConversationsQueries } from '@/modules/ai/hooks/queries';
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { showPromise } from '@/shared/ui/hooks/toast';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
interface UseAIConversationsOptions {
    navigateOnConversationChange?: boolean;
    onConversationChange?: (conversationId?: string) => void;
    onConversationCreated?: () => void;
    checkAccessDeniedError: (error: unknown) => boolean;
}

const useAIConversations = (
    teamId: string | null,
    conversationId: string | undefined,
    options: UseAIConversationsOptions
) => {
    const navigate = useNavigate();
    const {
        navigateOnConversationChange = true,
        onConversationChange,
        onConversationCreated,
        checkAccessDeniedError
    } = options;

    const conversationsResult = conversationQuery.useListQuery(
        {
            page: 1,
            limit: 100,
            includeArchived: false
        },
        { enabled: Boolean(teamId) }
    );

    const conversations = useMemo(() => {
        return conversationsResult.data?.data ?? [];
    }, [conversationsResult.data]);

    const createConversationMutationResult = conversationQuery.useCreateMutation();
    const deleteConversationMutationResult = conversationQuery.useDeleteMutation();
    const renameConversationMutationResult = conversationQuery.useUpdateMutation();

    let conversationsError: string | null = null;
    if (conversationsResult.error) {
        conversationsError = 'Failed to load conversations. Please try again.';
    }

    const handleConversationChange = useCallback((targetConversationId?: string) => {
        if (navigateOnConversationChange) {
            if (targetConversationId) {
                navigate(`/dashboard/ai/${targetConversationId}`);
            } else {
                navigate('/dashboard/ai');
            }
        }
        onConversationChange?.(targetConversationId);
    }, [navigate, navigateOnConversationChange, onConversationChange]);

    const handleCreateConversation = useCallback(async (initialTitle?: string) => {
        try {
            const conversation = await createConversationMutationResult.mutateAsync({
                title: initialTitle?.trim() || 'New Conversation'
            });

            onConversationCreated?.();
            handleConversationChange(conversation._id);
            return conversation;
        } catch (error) {
            if (checkAccessDeniedError(error)) throw error;
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to create conversation'
            });
            throw error;
        }
    }, [handleConversationChange, createConversationMutationResult, checkAccessDeniedError, onConversationCreated]);

    const handleDeleteConversation = useCallback(async (targetConversationId: string) => {
        await showPromise(
            deleteConversationMutationResult.mutateAsync(targetConversationId),
            {
                loading: { title: 'Deleting conversation...' },
                success: { title: 'Conversation deleted' },
                error: { title: 'Failed to delete conversation' }
            }
        );
        if (conversationId === targetConversationId) {
            handleConversationChange(undefined);
        }
    }, [conversationId, handleConversationChange, deleteConversationMutationResult]);

    const handleRenameConversation = useCallback(async (targetConversationId: string, title: string) => {
        const normalizedTitle = title.trim();
        if (!normalizedTitle) return;

        try {
            await renameConversationMutationResult.mutateAsync({
                id: targetConversationId,
                params: { title: normalizedTitle }
            });
        } catch (error) {
            if (checkAccessDeniedError(error)) throw error;
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to rename conversation'
            });
            throw error;
        }
    }, [renameConversationMutationResult, checkAccessDeniedError]);

    return {
        conversations,
        isConversationsLoading: conversationsResult.isLoading,
        conversationsError,
        loadConversations: invalidateConversationsQueries,
        handleSelectConversation: handleConversationChange,
        handleCreateConversation,
        handleDeleteConversation,
        handleRenameConversation
    };
};

export default useAIConversations;
