import React from 'react';
import type { Message } from '@/types/chat';
import { formatDistanceToNow } from 'date-fns';
import TextMessage from '@/features/chat/components/atoms/TextMessage';
import FileMessage from '@/features/chat/components/atoms/FileMessage';
import MessageControls from '@/features/chat/components/atoms/MessageControls';
import ReactionsBar from '@/features/chat/components/atoms/ReactionsBar';
import Paragraph from '@/components/primitives/Paragraph';
import Button from '@/components/primitives/Button';
import '@/features/chat/components/molecules/MessageItem/MessageItem.css';

type MessageItemProps = {
    msg: Message;
    isOwn: boolean;
    isGroupChat?: boolean;
    onEdit: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onToggleReaction: (id: string, emoji: string) => void;
    isOptionsOpen: boolean;
    isReactionsOpen: boolean;
    currentChatId: string,
    onToggleOptions: (id: string) => void;
    onToggleReactions: (id: string) => void;
};

const MessageItem: React.FC<MessageItemProps> = ({
    msg,
    isOwn,
    isGroupChat = false,
    onEdit,
    onDelete,
    onToggleReaction,
    isOptionsOpen,
    isReactionsOpen,
    currentChatId,
    onToggleOptions,
    onToggleReactions
}: MessageItemProps) => {
    const isDeleted = msg.deleted;
    const isFile = msg.messageType === 'file';
    const showAvatar = isGroupChat && !isOwn;
    const sender = msg.sender;

    const [isEditing, setIsEditing] = React.useState(false);

    const handleSaveEdit = (content: string) => {
        onEdit(msg._id, content);
        setIsEditing(false);
    };

    return (
        <div className={`d-flex chat-message ${isOwn ? 'sent' : 'received'} ${isDeleted ? 'deleted' : ''} ${showAvatar ? 'with-avatar' : ''} p-relative`}>
            {showAvatar && (
                <div className='d-flex flex-center chat-message-avatar f-shrink-0'>
                    {sender?.avatar ? (
                        <img src={sender.avatar} alt="Sender Avatar" className='chat-avatar-img w-max h-max' />
                    ) : (
                        <span className='d-flex flex-center chat-avatar-initial w-max h-max font-weight-6'>
                            {sender?.firstName?.[0]?.toUpperCase() || '?'}
                        </span>
                    )}
                </div>
            )}
            <div className='d-flex column chat-message-wrapper w-max'>
                {showAvatar && (
                    <div className='chat-message-sender-name font-weight-6 color-secondary'>
                        {sender?.firstName} {sender?.lastName}
                    </div>
                )}
                <div className='chat-message-content p-relative'>
                    {isDeleted ? (
                        <Paragraph className='chat-message-text deleted-message font-size-2-5 color-primary color-secondary'>This message was deleted</Paragraph>
                    ) : isFile ? (
                        <FileMessage currentChatId={currentChatId} msg={msg} />
                    ) : (
                        <TextMessage
                            msg={msg}
                            isEditing={isEditing}
                            onCancel={() => setIsEditing(false)}
                            onSave={handleSaveEdit}
                        />
                    )}

                    {!isDeleted && !isEditing && (
                        <>
                            <MessageControls
                                isOwn={isOwn}
                                onOpenReactions={() => onToggleReactions(msg._id)}
                                onOpenOptions={() => onToggleOptions(msg._id)}
                                isOptionsOpen={isOptionsOpen}
                                onEdit={() => setIsEditing(true)}
                                onDelete={() => onDelete(msg._id)}
                            />
                            {isReactionsOpen && (
                                <div className='d-flex gap-025 chat-message-reactions-menu p-absolute p-05'>
                                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map(e =>
                                        <Button key={e} variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => {
                                            onToggleReaction(msg._id, e);
                                            onToggleReactions(msg._id);
                                        }}>{e}</Button>
                                    )}
                                </div>
                            )}
                            <ReactionsBar
                                reactions={msg.reactions}
                                onToggle={(emoji) => onToggleReaction(msg._id, emoji)}
                            />
                        </>
                    )}

                    <div className='d-flex items-center gap-05 chat-message-time font-size-1 color-muted'>{formatDistanceToNow(msg.createdAt, { addSufix: true })}</div>
                </div>
            </div>
        </div>
    )
};

export default MessageItem;
