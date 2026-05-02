import { ChatMessageType } from '../../api/entities/message';
import { ErrorSurface, isAccessDeniedError, isApiError, reportError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import type { ChatMessage } from '../../api/entities/message';

interface MessageActionDependencies {
    chatId?: string;
}

export const sendTextMessageAction = async (
    { chatId }: MessageActionDependencies,
    sendMessageMutation: (input: { chatId: string; content: string; messageType: ChatMessageType.Text }) => Promise<ChatMessage>,
    content: string
) => {
    if (!chatId || !content.trim()) return;

    try {
        return await sendMessageMutation({
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

export const sendFileMessageAction = async (
    { chatId }: MessageActionDependencies,
    sendFileMutation: (input: { chatId: string; file: File }) => Promise<ChatMessage>,
    file: File
) => {
    if (!chatId) return;

    try {
        return await sendFileMutation({ chatId, file });
    } catch (error: unknown) {
        if (isApiError(error) || isAccessDeniedError(error)) {
            reportError(error, { surface: ErrorSurface.Toast });
            throw error;
        }

        sileo.error({ title: 'Failed to send file' });
        throw error;
    }
};

export const editMessageAction = async (
    { chatId }: MessageActionDependencies,
    editMessageMutation: (input: { chatId: string; messageId: string; content: string }) => Promise<ChatMessage>,
    messageId: string,
    content: string
) => {
    if (!chatId) return;

    return showPromise(editMessageMutation({ chatId, messageId, content }), {
        loading: { title: 'Saving changes...' },
        success: { title: 'Message updated' },
        error: { title: 'Failed to edit message' }
    });
};

export const deleteMessageAction = async (
    { chatId }: MessageActionDependencies,
    deleteMessageMutation: (input: { chatId: string; messageId: string }) => Promise<void>,
    messageId: string
) => {
    if (!chatId) return;

    await showPromise(deleteMessageMutation({ chatId, messageId }), {
        loading: { title: 'Deleting message...' },
        success: { title: 'Message deleted' },
        error: { title: 'Failed to delete message' }
    });
};

export const toggleReactionAction = async (
    { chatId }: MessageActionDependencies,
    toggleReactionMutation: (input: { chatId: string; messageId: string; emoji: string }) => Promise<ChatMessage>,
    messageId: string,
    emoji: string
) => {
    if (!chatId) return;

    try {
        await toggleReactionMutation({ chatId, messageId, emoji });
    } catch {
        sileo.error({ title: 'Failed to update reaction' });
    }
};
