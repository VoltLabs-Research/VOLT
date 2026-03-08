import { useCallback } from 'react';
import {
    useSendMessageMutation,
    useSendFileMutation,
    useEditMessageMutation,
    useDeleteMessageMutation,
    useToggleReactionMutation
} from './message/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';

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
            const message = await sendMessageMutationResult.mutateAsync({
                chatId,
                content: content.trim(),
                messageType: 'text'
            });
            return message;
        } catch (error) {
            if (ApiError.isRBACError(error)) {
                const friendlyMessage = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'You do not have permission to send messages';
                sileo.error({ title: friendlyMessage });
                return;
            }
            sileo.error({ title: 'Failed to send message' });
        }
    }, [chatId, sendMessageMutationResult]);

    const sendFileMessage = useCallback(async (file: File) => {
        if (!chatId) return;

        try {
            const message = await sendFileMutationResult.mutateAsync({
                chatId,
                file
            });
            return message;
        } catch (error) {
            if (ApiError.isRBACError(error)) {
                const friendlyMessage = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'You do not have permission to send files';
                sileo.error({ title: friendlyMessage });
                throw error;
            }
            sileo.error({ title: 'Failed to send file' });
            throw error;
        }
    }, [chatId, sendFileMutationResult]);

    const editMessage = useCallback(async (messageId: string, content: string) => {
        if (!chatId) return;

        const message = await showPromise(
            editMessageMutationResult.mutateAsync({
                chatId,
                messageId,
                content
            }),
            {
                loading: { title: 'Saving changes...' },
                success: { title: 'Message updated' },
                error: { title: 'Failed to edit message' }
            }
        );
        return message;
    }, [chatId, editMessageMutationResult]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!chatId) return;

        await showPromise(
            deleteMessageMutationResult.mutateAsync({
                chatId,
                messageId
            }),
            {
                loading: { title: 'Deleting message...' },
                success: { title: 'Message deleted' },
                error: { title: 'Failed to delete message' }
            }
        );
    }, [chatId, deleteMessageMutationResult]);

    const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!chatId) return;

        try {
            await toggleReactionMutationResult.mutateAsync({
                chatId,
                messageId,
                emoji
            });
        } catch {
            sileo.error({ title: 'Failed to update reaction' });
        }
    }, [chatId, toggleReactionMutationResult]);

    return {
        sendMessage,
        sendFileMessage,
        editMessage,
        deleteMessage,
        toggleReaction
    };
};

export default useMessageActions;
