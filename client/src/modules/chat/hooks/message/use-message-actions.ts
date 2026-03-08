import {
    useSendMessageMutation,
    useSendFileMutation,
    useEditMessageMutation,
    useDeleteMessageMutation,
    useToggleReactionMutation
} from './queries';
import { useCallback } from 'react';
import {
    deleteMessageAction,
    editMessageAction,
    sendFileMessageAction,
    sendTextMessageAction,
    toggleReactionAction
} from '../../services/message/actions';

interface UseMessageActionsOptions {
    chatId?: string;
};

const useMessageActions = ({ chatId }: UseMessageActionsOptions) => {
    const sendMessageMutationResult = useSendMessageMutation();
    const sendFileMutationResult = useSendFileMutation();
    const editMessageMutationResult = useEditMessageMutation();
    const deleteMessageMutationResult = useDeleteMessageMutation();
    const toggleReactionMutationResult = useToggleReactionMutation();

    const sendMessage = useCallback(async (content: string) => {
        return sendTextMessageAction({ chatId }, sendMessageMutationResult.mutateAsync, content);
    }, [chatId, sendMessageMutationResult]);

    const sendFileMessage = useCallback(async (file: File) => {
        return sendFileMessageAction({ chatId }, sendFileMutationResult.mutateAsync, file);
    }, [chatId, sendFileMutationResult]);

    const editMessage = useCallback(async (messageId: string, content: string) => {
        return editMessageAction({ chatId }, editMessageMutationResult.mutateAsync, messageId, content);
    }, [chatId, editMessageMutationResult]);

    const deleteMessage = useCallback(async (messageId: string) => {
        return deleteMessageAction({ chatId }, deleteMessageMutationResult.mutateAsync, messageId);
    }, [chatId, deleteMessageMutationResult]);

    const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
        return toggleReactionAction({ chatId }, toggleReactionMutationResult.mutateAsync, messageId, emoji);
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
