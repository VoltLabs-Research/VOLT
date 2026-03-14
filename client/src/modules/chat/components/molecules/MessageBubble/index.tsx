import type { ReactNode } from 'react';
import { ChatMessageType } from '@/modules/chat/api/entities/message';
import ReactionsDisplay from '../../atoms/ReactionsDisplay';
import { cn } from '@/shared/utils';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Avatar from '@/shared/presentation/components/Avatar';
import FileAttachment from '@/shared/presentation/components/FileAttachment';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import './MessageBubble.css';

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    isGroupChat?: boolean;
    currentUserId?: string;
    onToggleReaction?: (emoji: string) => void;
    children?: ReactNode;
};

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
    const handleToggleReaction = onToggleReaction ?? (() => undefined);
    let messageContent: ReactNode;

    if (isDeleted) {
        messageContent = (
            <Paragraph className='message-bubble-text font-size-2 color-muted' style={{ fontStyle: 'italic' }}>
                This message was deleted
            </Paragraph>
        );
    } else if (isFile) {
        messageContent = (
            <FileAttachment
                fileName={message.metadata?.fileName}
                fileSize={message.metadata?.fileSize}
                fileUrl={message.metadata?.fileUrl}
                fileType={message.metadata?.fileType}
                showDownload={!!message.metadata?.fileUrl}
                variant='compact'
                className='message-bubble-file'
            />
        );
    } else {
        messageContent = (
            <Paragraph className='message-bubble-text font-size-2'>
                {message.content}
            </Paragraph>
        );
    }

    return (
        <Container className={cn(
            'd-flex gap-075 message-bubble',
            isOwn ? 'sent' : 'received',
            isDeleted && 'deleted',
            showAvatar && 'with-avatar'
        )}>
            {showAvatar && (
                <Avatar user={message.sender} size='xs' className='message-bubble-avatar radius-full' />
            )}

                <Container className='d-flex column w-max'>
                    {showAvatar && (
                    <Paragraph className='message-bubble-sender font-weight-6 color-secondary font-size-2 mb-025'>
                        {message.sender.firstName} {message.sender.lastName}
                    </Paragraph>
                )}

                <Container className='message-bubble-content p-075 p-relative'>
                    {messageContent}

                    {!isDeleted && children}
                </Container>

                <Container className='d-flex items-center gap-05 message-bubble-time color-muted mt-05 font-size-2'>
                    <Paragraph>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</Paragraph>
                    {message.editedAt && (
                        <Paragraph className='message-bubble-edited'>(edited)</Paragraph>
                    )}
                </Container>

                {!isDeleted && message.reactions && message.reactions.length > 0 && (
                    <ReactionsDisplay
                        reactions={message.reactions}
                        currentUserId={currentUserId}
                        onToggle={handleToggleReaction}
                    />
                )}
            </Container>
        </Container>
    );
};

export default MessageBubble;
