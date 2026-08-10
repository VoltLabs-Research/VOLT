import ChatInput from '../ChatInput';
import EditMessageModal, { EDIT_MESSAGE_MODAL_ID } from '../EditMessageModal';
import ChatHeader from '../ChatHeader';
import MessageBubble from '../MessageBubble';
import MessageControls from '../MessageControls';
import MessageList from '../MessageList';
import TypingIndicator from '../TypingIndicator';
import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { openModal } from '@/shared/ui/modal';
import { confirm } from '@/shared/ui/hooks/use-confirm';
import { hasUserReactedWith } from '@/modules/chat/utils/reactions';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';
import type { TypingUser } from '@volt/contracts/modules/chat/domain';

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

/*
 * `chat-area` is not this component's own styling — it was MessagesPage's handle
 * for the responsive master-detail swap, and it stays on the element because the
 * swap is still keyed off the page's state flags. What changed is where the swap
 * is written: the rules that used to be `.messages-page > .chat-area` in
 * MessagesPage.css are the variants below.
 *
 * Below 768px the pane is hidden and the sidebar owns the viewport, unless a chat
 * is open. Below 1024px an open details panel takes the viewport instead — which
 * is why the chat-open variant excludes that case rather than relying on which
 * rule the cascade happens to reach last, as the two stylesheets did.
 */
const AREA_CLASS_NAMES = 'flex h-full flex-1 min-w-0 chat-area max-[768px]:hidden max-[768px]:w-full max-[768px]:min-w-0 max-[1024px]:[.messages-page--details-open_&]:hidden max-[768px]:[.messages-page--chat-open:not(.messages-page--details-open)_&]:flex';

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
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

    const handleEditClick = (message: ChatMessage) => {
        setEditingMessage(message);
        openModal(EDIT_MESSAGE_MODAL_ID);
    };

    const handleDeleteClick = async (messageId: string) => {
        const isConfirmed = await confirm({
            title: 'Delete this message?',
            confirmText: 'Delete'
        });

        if (!isConfirmed) {
            return;
        }

        await onDeleteMessage(messageId);
    };

    const handleToggleReaction = (message: ChatMessage, emoji: string) => {
        if (hasUserReactedWith(message.reactions, emoji, currentUserId)) {
            return onRemoveReaction(message._id, emoji);
        }

        return onSetReaction(message._id, emoji);
    };

    if (!chat) {
        return (
            <div className={`items-center justify-center ${AREA_CLASS_NAMES}`}>
                <RecoveryState
                    icon={<MessagesSquare size={32} />}
                    title='Welcome to Messages'
                    description='Select a conversation or start a new chat'
                />
            </div>
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
        <div className={`flex-col ${AREA_CLASS_NAMES}`}>
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
                onSave={onEditMessage}
                onClose={() => setEditingMessage(null)}
            />
        </div>
    );
};

export default ChatArea;
