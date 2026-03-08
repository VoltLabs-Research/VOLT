import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import { showPromise } from '@/shared/presentation/hooks/toast';
import {
    buildConversationsQueryParams,
    conversationsQuery,
    invalidateConversationsQueries,
    useCreateConversationMutation,
    useDeleteConversationMutation,
    useRenameConversationMutation
} from '@/modules/ai/hooks/queries';
import type { AIConversation } from '@/modules/ai/api/entities/ai-conversation';

const sortConversations = (conversations: AIConversation[]) => {
    return [...conversations].sort((left, right) => {
        const leftDate = left.lastMessageAt || left.updatedAt || left.createdAt;
        const rightDate = right.lastMessageAt || right.updatedAt || right.createdAt;
        return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });
};

interface UseAIConversationsOptions {
    navigateOnConversationChange?: boolean;
    onConversationChange?: (conversationId?: string) => void;
    onConversationCreated?: () => void;
    checkRBACError: (error: unknown) => boolean;
}

const useAIConversations = (
    teamId: string | null,
    conversationId: string | undefined,
    options: UseAIConversationsOptions
) => {
    const navigate = useNavigate();
    const navigateOnConversationChange = options.navigateOnConversationChange ?? true;

    const fallbackConversationsQueryParams = useMemo(() => buildConversationsQueryParams(''), []);

    const conversationsQueryParams = useMemo(() => {
        if (!teamId) {
            return undefined;
        }

        return buildConversationsQueryParams(teamId, {
            page: 1,
            limit: 100,
            includeArchived: false
        });
    }, [teamId]);

    const conversationsResult = conversationsQuery(conversationsQueryParams ?? fallbackConversationsQueryParams, {
        enabled: Boolean(conversationsQueryParams)
    });

    const conversations = useMemo(() => {
        return sortConversations(conversationsResult.data?.data ?? []);
    }, [conversationsResult.data]);

    const createConversationMutationResult = useCreateConversationMutation({
        conversationsQueryParams
    });
    const deleteConversationMutationResult = useDeleteConversationMutation({
        conversationsQueryParams
    });
    const renameConversationMutationResult = useRenameConversationMutation({
        conversationsQueryParams
    });

    const isConversationsLoading = conversationsResult.isLoading;
    const conversationsError = conversationsResult.error
        ? 'Failed to load conversations. Please try again.'
        : null;

    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation._id === conversationId) || null,
        [conversations, conversationId]
    );

    const handleConversationChange = useCallback((targetConversationId?: string) => {
        if (navigateOnConversationChange) {
            if (targetConversationId) {
                navigate(`/dashboard/ai/${targetConversationId}`);
            } else {
                navigate('/dashboard/ai');
            }
        }
        options.onConversationChange?.(targetConversationId);
    }, [navigate, navigateOnConversationChange, options.onConversationChange]);

    const handleSelectConversation = useCallback((targetConversationId: string) => {
        handleConversationChange(targetConversationId);
    }, [handleConversationChange]);

    const getConversationTitle = useCallback((value?: string) => {
        const normalizedValue = value?.trim();
        return normalizedValue || 'New Conversation';
    }, []);

    const handleCreateConversation = useCallback(async (initialTitle?: string) => {
        try {
            const message = initialTitle?.trim();
            const title = getConversationTitle(message);
            const result = await createConversationMutationResult.mutateAsync(message ? { title, message } : { title });

            options.onConversationCreated?.();
            handleConversationChange(result.conversation._id);
            return result.conversation;
        } catch (error) {
            if (options.checkRBACError(error)) throw error;
            sileo.error({ title: 'Failed to create conversation' });
            throw error;
        }
    }, [getConversationTitle, handleConversationChange, createConversationMutationResult, options.checkRBACError, options.onConversationCreated]);

    const handleDeleteConversation = useCallback(async (targetConversationId: string) => {
        await showPromise(
            deleteConversationMutationResult.mutateAsync({ conversationId: targetConversationId }),
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
                conversationId: targetConversationId,
                title: normalizedTitle
            });
        } catch (error) {
            if (options.checkRBACError(error)) throw error;
            sileo.error({ title: 'Failed to rename conversation' });
            throw error;
        }
    }, [renameConversationMutationResult, options.checkRBACError]);

    const loadConversations = useCallback(async () => {
        await invalidateConversationsQueries();
    }, []);

    return {
        activeConversation,
        conversations,
        isConversationsLoading,
        conversationsError,
        loadConversations,
        handleSelectConversation,
        handleCreateConversation,
        handleDeleteConversation,
        handleRenameConversation
    };
};

export default useAIConversations;
