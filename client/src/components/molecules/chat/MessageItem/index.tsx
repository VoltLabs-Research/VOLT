import React from 'react';
import type { Message } from '@/types/chat';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import TextMessage from '@/components/atoms/chat/TextMessage';
import FileMessage from '@/components/atoms/chat/FileMessage';
import MessageControls from '@/components/atoms/chat/MessageControls';
import ReactionsBar from '@/components/atoms/chat/ReactionsBar';
import Paragraph from '@/components/primitives/Paragraph';
import './MessageItem.css';

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

    return (
        <div className={`d-flex chat-message ${isOwn ? 'sent' : 'received'} ${isDeleted ? 'deleted' : ''} ${showAvatar ? 'with-avatar' : ''}`}>
            {showAvatar && (
                <div className='d-flex flex-center chat-message-avatar'>
                    {sender?.avatar ? (
                        <img src={sender.avatar} alt="Sender Avatar" className='chat-avatar-img' />
                    ) : (
                        <span className='d-flex flex-center chat-avatar-initial'>
                            {sender?.firstName?.[0]?.toUpperCase() || '?'}
                        </span>
                    )}
                </div>
            )}
            <div className='d-flex column chat-message-wrapper'>
                {showAvatar && (
                    <div className='chat-message-sender-name'>
                        {sender?.firstName} {sender?.lastName}
                    </div>
                )}
                <div className='chat-message-content'>
                    {isDeleted ? (
                        <Paragraph className='chat-message-text deleted-message'>This message was deleted</Paragraph>
                    ) : isFile ? (
                        <FileMessage currentChatId={currentChatId} msg={msg} />
                    ) : (
                        <TextMessage msg={msg} onSave={(content) => onEdit(msg._id, content)} />
                    )}

                    {!isDeleted && (
                        <>
                            <MessageControls
                                isOwn={isOwn}
                                onOpenReactions={() => onToggleReactions(msg._id)}
                                onOpenOptions={() => onToggleOptions(msg._id)}
                                isOptionsOpen={isOptionsOpen}
                                onEdit={() => onEdit(msg._id, msg.content)}
                                onDelete={() => onDelete(msg._id)}
                            />
                            {isReactionsOpen && (
                                <div className='d-flex gap-025 chat-message-reactions-menu'>
                                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map(e =>
                                        <button key={e} className='d-flex flex-center chat-reaction-btn' onClick={() => {
                                            onToggleReaction(msg._id, e);
                                            onToggleReactions(msg._id);
                                        }}>{e}</button>
                                    )}
                                </div>
                            )}
                            <ReactionsBar
                                reactions={msg.reactions}
                                onToggle={(emoji) => onToggleReaction(msg._id, emoji)}
                            />
                        </>
                    )}

                    <div className='d-flex items-center gap-05 chat-message-time'>{formatTimeAgo(msg.createdAt)}</div>
                </div>
            </div>
        </div>
    )
};

export default MessageItem;
