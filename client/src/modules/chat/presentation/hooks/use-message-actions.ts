import { useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import { useChatMessageStore } from '../stores';
import { CHAT_TOKENS } from '@/modules/chat/infrastructure/di/tokens';
import type IChatMessageRepository from '@/modules/chat/domain/ports/IChatMessageRepository';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';

const useMessageActions = (chatId?: string) => {
    const addMessage = useChatMessageStore((state) => state.addMessage);
    const updateMessage = useChatMessageStore((state) => state.updateMessage);

    const chatMessageRepository = useMemo(
        () => container.resolve<IChatMessageRepository>(CHAT_TOKENS.ChatMessageRepository),
        []
    );

    // HTTP creates the message & server broadcasts via socket to other users
    const sendMessage = useCallback(async (content: string) => {
        if (!chatId || !content.trim()) return;

        const message = await chatMessageRepository.sendMessage(chatId, {
            content: content.trim(),
            messageType: 'text'
        });
        
        addMessage(message);
        return message;
    }, [chatId, addMessage, chatMessageRepository]);

    const sendFileMessage = useCallback(async (file: File) => {
        if (!chatId) return;

        try {
            const message = await chatMessageRepository.sendFileMessage(chatId, file);
            addMessage(message);
            return message;
        } catch (error) {
            sileo.error({ title: 'Failed to send file' });
        }
    }, [chatId, addMessage, chatMessageRepository]);

    const editMessage = useCallback(async (messageId: string, content: string) => {
        if (!chatId) return;

        const message = await showPromise(
            chatMessageRepository.editMessage(chatId, messageId, content),
            {
                loading: { title: 'Saving changes...' },
                success: { title: 'Message updated' },
                error: { title: 'Failed to edit message' }
            }
        );
        updateMessage(messageId, message);
        return message;
    }, [chatId, updateMessage, chatMessageRepository]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!chatId) return;

        await showPromise(
            chatMessageRepository.deleteMessage(chatId, messageId),
            {
                loading: { title: 'Deleting message...' },
                success: { title: 'Message deleted' },
                error: { title: 'Failed to delete message' }
            }
        );
        updateMessage(messageId, { deleted: true });
    }, [chatId, updateMessage, chatMessageRepository]);

    const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!chatId) return;

        const message = await chatMessageRepository.toggleReaction(chatId, messageId, emoji);
        updateMessage(messageId, { reactions: message.reactions });
    }, [chatId, updateMessage, chatMessageRepository]);

    return {
        sendMessage,
        sendFileMessage,
        editMessage,
        deleteMessage,
        toggleReaction
    };
};

export default useMessageActions;
