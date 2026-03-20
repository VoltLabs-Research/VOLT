import ChatInput from '../ChatInput';
import { EDIT_MESSAGE_MODAL_ID } from '../../molecules/EditMessageModal';
import EditMessageModal from '../../molecules/EditMessageModal';
import ChatHeader from '../../molecules/ChatHeader';
import MessageBubble from '../../molecules/MessageBubble';
import MessageControls from '../../molecules/MessageControls';
import MessageList from '../../molecules/MessageList';
import TypingIndicator from '../../atoms/TypingIndicator';
import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { useState, useCallback } from 'react';
import { IoChatbubblesOutline } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { openModal } from '@/shared/presentation/components/Modal';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import type { TypingUser } from '@/modules/chat/api/entities/shared/chat-events';
import './ChatArea.css';

interface EditingMessage {
    _id: string;
    content: string;
};

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
    onToggleReaction: (messageId: string, emoji: string) => Promise<unknown>;
    onInfoClick?: () => void;
};

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
    onToggleReaction,
    onInfoClick
}: ChatAreaProps) => {
    const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);

    const handleEditClick = useCallback((message: ChatMessage) => {
        setEditingMessage({ _id: message._id, content: message.content });
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

    const renderMessage = (message: ChatMessage) => (
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
    );

    return (
        <Container className='d-flex column h-max chat-area'>
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
                disabled={false}
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
        </Container>
    );
};

export default ChatArea;
