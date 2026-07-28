import ChatInput from '../ChatInput';
import EditMessageModal, { EDIT_MESSAGE_MODAL_ID } from '../EditMessageModal';
import ChatHeader from '../ChatHeader';
import MessageBubble from '../MessageBubble';
import MessageControls from '../MessageControls';
import MessageList from '../MessageList';
import TypingIndicator from '../TypingIndicator';
import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { useState, useCallback } from 'react';
import { IoChatbubblesOutline } from 'react-icons/io5';
import { EmptyState, Box, openModal, Stack } from '@voltstack/bravais';
import { confirm } from '@/shared/ui/hooks/use-confirm';
import { hasUserReactedWith } from '@/modules/chat/utils/reactions';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';
import type { TypingUser } from '@volt/contracts/modules/chat/domain';
import './ChatArea.css';

interface EditingMessage {
    _id: string;
    content: string;
}

interface ChatAreaProps {
    chat: Chat | null;
    messages: ChatMessage[];
    typingUsers: TypingUser[];
    currentUserId?: string;
    presence?: PresenceStatus;
    isLoading?: boolean;
    isSending?: boolean;
    isDetailsOpen?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    onBackClick?: () => void;
    onTyping: () => void;
    onSendText: (text: string) => Promise<unknown>;
    onSendFiles: (files: File[]) => Promise<unknown>;
    onEditMessage: (messageId: string, content: string) => Promise<unknown>;
    onDeleteMessage: (messageId: string) => Promise<unknown>;
    onSetReaction: (messageId: string, emoji: string) => Promise<unknown>;
    onRemoveReaction: (messageId: string, emoji: string) => Promise<unknown>;
    onInfoClick?: () => void;
}

const ChatArea = ({
    chat,
    messages,
    typingUsers,
    currentUserId,
    presence = PresenceStatus.Unknown,
    isLoading = false,
    isSending = false,
    isDetailsOpen = false,
    hasMore,
    onLoadMore,
    onBackClick,
    onTyping,
    onSendText,
    onSendFiles,
    onEditMessage,
    onDeleteMessage,
    onSetReaction,
    onRemoveReaction,
    onInfoClick
}: ChatAreaProps) => {
    const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);

    const handleEditClick = useCallback((message: ChatMessage) => {
        setEditingMessage({
            _id: message._id,
            content: message.content
        });
        openModal(EDIT_MESSAGE_MODAL_ID);
    }, []);

    const handleEditSave = useCallback(async (messageId: string, newContent: string) => {
        await onEditMessage(messageId, newContent);
    }, [onEditMessage]);

    const handleEditClose = useCallback(() => {
        setEditingMessage(null);
    }, []);

    const handleDeleteClick = useCallback(async (messageId: string) => {
        const isConfirmed = await confirm({
            title: 'Delete this message?',
            confirmText: 'Delete'
        });

        if (!isConfirmed) {
            return;
        }

        await onDeleteMessage(messageId);
    }, [confirm, onDeleteMessage]);

    const handleToggleReaction = useCallback((message: ChatMessage, emoji: string) => {
        if (hasUserReactedWith(message.reactions, emoji, currentUserId)) {
            return onRemoveReaction(message._id, emoji);
        }

        return onSetReaction(message._id, emoji);
    }, [currentUserId, onRemoveReaction, onSetReaction]);

    if (!chat) {
        return (
            <Box display='flex' height='max' className='flex-center chat-area chat-area-empty'>
                <EmptyState
                    icon={<IoChatbubblesOutline size={32} />}
                    title='Welcome to Messages'
                    description='Select a conversation or start a new chat'
                />
            </Box>
        );
    }

    const renderMessage = (message: ChatMessage) => (
        <MessageBubble
            key={message._id}
            message={message}
            isOwn={message.sender._id === currentUserId}
            isGroupChat={chat.isGroup}
            currentUserId={currentUserId}
            onToggleReaction={(emoji: string) => handleToggleReaction(message, emoji)}
        >
            <MessageControls
                messageId={message._id}
                isOwn={message.sender._id === currentUserId}
                onReact={(emoji: string) => onSetReaction(message._id, emoji)}
                onEdit={() => handleEditClick(message)}
                onDelete={() => handleDeleteClick(message._id)}
            />
        </MessageBubble>
    );

    return (
        <Stack height='max' className='chat-area'>
            <ChatHeader
                chat={chat}
                currentUserId={currentUserId}
                presence={presence}
                onBackClick={onBackClick}
                onInfoClick={onInfoClick}
                isDetailsOpen={isDetailsOpen}
            />

            <MessageList
                messages={messages}
                isLoading={isLoading}
                hasMore={hasMore}
                onLoadMore={onLoadMore}
                renderMessage={renderMessage}
            />

            <TypingIndicator users={typingUsers} />

            <ChatInput
                isSending={isSending}
                onTyping={onTyping}
                onSendText={onSendText}
                onSendFiles={onSendFiles}
            />

            <EditMessageModal
                messageId={editingMessage?._id ?? null}
                initialContent={editingMessage?.content ?? ''}
                onSave={handleEditSave}
                onClose={handleEditClose}
            />
        </Stack>
    );
};

export default ChatArea;
