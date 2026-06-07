import type { ReactNode } from 'react';
import { ChatMessageType } from '@/modules/chat/api/entities/message';
import ReactionsDisplay from '../ReactionsDisplay';
import { cn } from '@/shared/utils/cn';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, Box, Row, Stack, Text } from '@voltstack/bravais';
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
    const handleToggleReaction = onToggleReaction ?? (() => undefined);
    let messageContent: ReactNode;

    if (isDeleted) {
        messageContent = (
            <Text as='p' size='md' tone='muted' className='message-bubble-text' style={{ fontStyle: 'italic' }}>
                This message was deleted
            </Text>
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
            <Text as='p' size='md' className='message-bubble-text'>
                {message.content}
            </Text>
        );
    }

    return (
        <Box display='flex' gap='075' className={cn(
            'message-bubble',
            isOwn ? 'sent' : 'received',
            isDeleted && 'deleted',
            showAvatar && 'with-avatar'
        )}>
            {showAvatar && (
                <Avatar user={message.sender} size='xs' className='message-bubble-avatar radius-full' />
            )}

                <Stack width='max'>
                    {showAvatar && (
                    <Text as='p' size='md' weight='bold' tone='secondary' className='message-bubble-sender mb-025'>
                        {message.sender.firstName} {message.sender.lastName}
                    </Text>
                )}

                <Box position='relative' p='075' className='message-bubble-content'>
                    {messageContent}

                    {!isDeleted && children}
                </Box>

                <Row gap='05' className='message-bubble-time color-muted mt-05 font-size-2'>
                    <Text as='p'>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</Text>
                    {message.editedAt && (
                        <Text as='p' className='message-bubble-edited'>(edited)</Text>
                    )}
                </Row>

                {!isDeleted && message.reactions && message.reactions.length > 0 && (
                    <ReactionsDisplay
                        reactions={message.reactions}
                        currentUserId={currentUserId}
                        onToggle={handleToggleReaction}
                    />
                )}
            </Stack>
        </Box>
    );
};

export default MessageBubble;
