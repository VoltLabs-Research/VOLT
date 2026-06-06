import {
    useSendMessageMutation,
    useSendFileMutation,
    useEditMessageMutation,
    useDeleteMessageMutation,
    useToggleReactionMutation
} from './queries';
import { useCallback } from 'react';
import { ChatMessageType } from '../../api/entities/message';
import { ErrorSurface, isAccessDeniedError, isApiError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';

interface UseMessageActionsOptions {
    chatId?: string;
}

const useMessageActions = ({ chatId }: UseMessageActionsOptions) => {
    const sendMessageMutationResult = useSendMessageMutation();
    const sendFileMutationResult = useSendFileMutation();
    const editMessageMutationResult = useEditMessageMutation();
    const deleteMessageMutationResult = useDeleteMessageMutation();
    const toggleReactionMutationResult = useToggleReactionMutation();

    const sendMessage = useCallback(async (content: string) => {
        if (!chatId || !content.trim()) return;

        try {
            return await sendMessageMutationResult.mutateAsync({
                chatId,
                content: content.trim(),
                messageType: ChatMessageType.Text
            });
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) {
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to send messages'
                });
                return;
            }

            sileo.error({ title: 'Failed to send message' });
        }
    }, [chatId, sendMessageMutationResult]);

    const sendFileMessage = useCallback(async (file: File) => {
        if (!chatId) return;

        try {
            return await sendFileMutationResult.mutateAsync({ chatId, file });
        } catch (error: unknown) {
            if (isApiError(error) || isAccessDeniedError(error)) {
                reportError(error, { surface: ErrorSurface.Toast });
                throw error;
            }

            sileo.error({ title: 'Failed to send file' });
            throw error;
        }
    }, [chatId, sendFileMutationResult]);

    const editMessage = useCallback(async (messageId: string, content: string) => {
        if (!chatId) return;

        return showPromise(editMessageMutationResult.mutateAsync({ chatId, messageId, content }), {
            loading: { title: 'Saving changes...' },
            success: { title: 'Message updated' },
            error: { title: 'Failed to edit message' }
        });
    }, [chatId, editMessageMutationResult]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!chatId) return;

        await showPromise(deleteMessageMutationResult.mutateAsync({ chatId, messageId }), {
            loading: { title: 'Deleting message...' },
            success: { title: 'Message deleted' },
            error: { title: 'Failed to delete message' }
        });
    }, [chatId, deleteMessageMutationResult]);

    const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!chatId) return;

        try {
            await toggleReactionMutationResult.mutateAsync({ chatId, messageId, emoji });
        } catch {
            sileo.error({ title: 'Failed to update reaction' });
        }
    }, [chatId, toggleReactionMutationResult]);

    return {
        sendMessage,
        sendFileMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        isSendingMessage: sendMessageMutationResult.isPending,
        isSendingFile: sendFileMutationResult.isPending
    };
};

export default useMessageActions;
