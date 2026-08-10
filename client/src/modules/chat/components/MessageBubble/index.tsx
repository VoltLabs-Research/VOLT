import type { ReactNode } from 'react';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import ReactionsDisplay from '../ReactionsDisplay';
import { cn } from '@/shared/utils/cn';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@voltstack/bravais';
import FileAttachment from '@/shared/ui/components/FileAttachment';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';
import './MessageBubble.css';

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    isGroupChat?: boolean;
    currentUserId?: string;
    onToggleReaction?: (emoji: string) => void;
    children?: ReactNode;
}

const MessageBubble = ({
    message,
    isOwn,
    isGroupChat = false,
    currentUserId,
    onToggleReaction,
    children
}: MessageBubbleProps) => {
    const showAvatar = isGroupChat && !isOwn;
    const isFile = message.messageType === ChatMessageType.File;
    const isDeleted = message.deleted;
    let messageContent: ReactNode;

    if (isDeleted) {
        messageContent = (
            <p className='text-sm text-muted message-bubble-text' style={{ fontStyle: 'italic' }}>
                This message was deleted
            </p>
        );
    } else if (isFile) {
        messageContent = (
            <FileAttachment
                fileName={message.metadata?.fileName}
                fileSize={message.metadata?.fileSize}
                fileUrl={message.metadata?.fileUrl}
                fileType={message.metadata?.fileType}
                showDownload={!!message.metadata?.fileUrl}
                className='message-bubble-file'
            />
        );
    } else {
        messageContent = (
            <p className='text-sm message-bubble-text'>
                {message.content}
            </p>
        );
    }

    return (
        <div className={cn('flex gap-3', cn(
            'message-bubble',
            isOwn ? 'sent' : 'received',
            isDeleted && 'deleted',
            showAvatar && 'with-avatar'
        ))}>
            {showAvatar && (
                <Avatar user={message.sender} size='xs' className='message-bubble-avatar rounded-full' />
            )}

                <div className='flex flex-col w-full'>
                    {showAvatar && (
                    <p className='text-sm font-semibold text-muted message-bubble-sender mb-1'>
                        {message.sender.firstName} {message.sender.lastName}
                    </p>
                )}

                <div className='p-3 relative message-bubble-content'>
                    {messageContent}

                    {!isDeleted && children}
                </div>

                <div className='flex flex-row items-center gap-2 message-bubble-time text-muted mt-2 text-sm'>
                    <p>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</p>
                </div>

                {!isDeleted && message.reactions && message.reactions.length > 0 && (
                    <ReactionsDisplay
                        reactions={message.reactions}
                        currentUserId={currentUserId}
                        onToggle={onToggleReaction ?? (() => undefined)}
                    />
                )}
            </div>
        </div>
    );
};

export default MessageBubble;
