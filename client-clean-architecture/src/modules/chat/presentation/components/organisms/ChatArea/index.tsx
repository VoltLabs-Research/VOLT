import { useState, useCallback } from 'react';
import { IoChatbubblesOutline } from 'react-icons/io5';
import type { Chat, ChatMessage, TypingUser, PresenceStatus } from '@/modules/chat/domain/entities';
import { ChatHeader, MessageList, MessageBubble, MessageControls, EditMessageModal, EDIT_MESSAGE_MODAL_ID } from '../../molecules';
import { TypingIndicator } from '../../atoms';
import ChatInput from '../ChatInput';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { openModal } from '@/shared/presentation/components/Modal';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import './ChatArea.css';

interface ChatAreaProps {
    chat: Chat | null;
    messages: ChatMessage[];
    typingUsers: TypingUser[];
    currentUserId?: string;
    presence?: PresenceStatus;
    isLoading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    onTyping: () => void;
    onSendText: (text: string) => Promise<unknown>;
    onSendFiles: (files: File[]) => Promise<unknown>;
    onEditMessage: (messageId: string, content: string) => Promise<unknown>;
    onDeleteMessage: (messageId: string) => Promise<unknown>;
    onToggleReaction: (messageId: string, emoji: string) => Promise<unknown>;
    onInfoClick?: () => void;
};

const ChatArea = ({
    chat,
    messages,
    typingUsers,
    currentUserId,
    presence = 'unknown',
    isLoading = false,
    hasMore,
    onLoadMore,
    onTyping,
    onSendText,
    onSendFiles,
    onEditMessage,
    onDeleteMessage,
    onToggleReaction,
    onInfoClick
}: ChatAreaProps) => {
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

    const handleEditClick = useCallback((message: ChatMessage) => {
        setEditingMessage({ id: message._id, content: message.content });
        openModal(EDIT_MESSAGE_MODAL_ID);
    }, []);

    const handleEditSave = useCallback(async (messageId: string, newContent: string) => {
        await onEditMessage(messageId, newContent);
    }, [onEditMessage]);

    const handleEditClose = useCallback(() => {
        setEditingMessage(null);
    }, []);

    const handleDeleteClick = useCallback((messageId: string) => {
        if (confirm('Delete this message?')) {
            onDeleteMessage(messageId);
        }
    }, [onDeleteMessage]);

    if (!chat) {
        return (
            <Container className='d-flex flex-center h-max chat-area chat-area-empty'>
                <EmptyState
                    icon={<IoChatbubblesOutline size={32} />}
                    title='Welcome to Messages'
                    description='Select a conversation or start a new chat'
                />
            </Container>
        );
    }

    return (
        <Container className='d-flex column h-max chat-area'>
            <ChatHeader
                chat={chat}
                currentUserId={currentUserId}
                presence={presence}
                onInfoClick={onInfoClick}
            />

            <MessageList
                messages={messages}
                isLoading={isLoading}
                hasMore={hasMore}
                onLoadMore={onLoadMore}
                renderMessage={(message: ChatMessage) => (
                    <MessageBubble
                        key={message._id}
                        message={message}
                        isOwn={message.sender._id === currentUserId}
                        isGroupChat={chat.isGroup}
                        currentUserId={currentUserId}
                        onToggleReaction={(emoji: string) => onToggleReaction(message._id, emoji)}
                    >
                        <MessageControls
                            messageId={message._id}
                            isOwn={message.sender._id === currentUserId}
                            onReact={(emoji: string) => onToggleReaction(message._id, emoji)}
                            onEdit={() => handleEditClick(message)}
                            onDelete={() => handleDeleteClick(message._id)}
                        />
                    </MessageBubble>
                )}
            />

            <TypingIndicator users={typingUsers} />

            <ChatInput
                disabled={false}
                onTyping={onTyping}
                onSendText={onSendText}
                onSendFiles={onSendFiles}
            />

            <EditMessageModal
                messageId={editingMessage?.id ?? null}
                initialContent={editingMessage?.content ?? ''}
                onSave={handleEditSave}
                onClose={handleEditClose}
            />
        </Container>
    );
};

export default ChatArea;
