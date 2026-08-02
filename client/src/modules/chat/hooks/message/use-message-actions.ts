import {
    useSendMessageMutation,
    useSendFileMutation,
    useEditMessageMutation,
    useDeleteMessageMutation,
    useSetReactionMutation,
    useRemoveReactionMutation
} from './queries';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import { ErrorSurface, isAccessDeniedError, isApiError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/ui/hooks/toast';
import { sileo } from 'sileo';

const useMessageActions = (chatId?: string) => {
    const sendMessageMutationResult = useSendMessageMutation();
    const sendFileMutationResult = useSendFileMutation();
    const editMessageMutationResult = useEditMessageMutation();
    const deleteMessageMutationResult = useDeleteMessageMutation();
    const setReactionMutationResult = useSetReactionMutation();
    const removeReactionMutationResult = useRemoveReactionMutation();

    const sendMessage = async (content: string) => {
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
    };

    const sendFileMessage = async (file: File) => {
        if (!chatId) return;

        try {
            return await sendFileMutationResult.mutateAsync({
                chatId,
                file
            });
        } catch (error: unknown) {
            if (isApiError(error) || isAccessDeniedError(error)) {
                reportError(error, { surface: ErrorSurface.Toast });
                throw error;
            }

            sileo.error({ title: 'Failed to send file' });
            throw error;
        }
    };

    const editMessage = async (messageId: string, content: string) => {
        if (!chatId) return;

        return showPromise(editMessageMutationResult.mutateAsync({
            chatId,
            messageId,
            content
        }), {
            loading: { title: 'Saving changes...' },
            success: { title: 'Message updated' },
            error: { title: 'Failed to edit message' }
        });
    };

    const deleteMessage = async (messageId: string) => {
        if (!chatId) return;

        await showPromise(deleteMessageMutationResult.mutateAsync({
            chatId,
            messageId
        }), {
            loading: { title: 'Deleting message...' },
            success: { title: 'Message deleted' },
            error: { title: 'Failed to delete message' }
        });
    };

    const setReaction = async (messageId: string, emoji: string) => {
        if (!chatId) return;

        try {
            await setReactionMutationResult.mutateAsync({
                chatId,
                messageId,
                emoji
            });
        } catch {
            sileo.error({ title: 'Failed to update reaction' });
        }
    };

    const removeReaction = async (messageId: string, emoji: string) => {
        if (!chatId) return;

        try {
            await removeReactionMutationResult.mutateAsync({
                chatId,
                messageId,
                emoji
            });
        } catch {
            sileo.error({ title: 'Failed to update reaction' });
        }
    };

    return {
        sendMessage,
        sendFileMessage,
        editMessage,
        deleteMessage,
        setReaction,
        removeReaction,
        isSendingMessage: sendMessageMutationResult.isPending,
        isSendingFile: sendFileMutationResult.isPending
    };
};

export default useMessageActions;
