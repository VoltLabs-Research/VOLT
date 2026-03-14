import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../../atoms/ChatAvatar';
import { IoArrowBackOutline, IoInformationCircleOutline } from 'react-icons/io5';
import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusDot from '@/shared/presentation/components/StatusDot';
import type { Chat } from '@/modules/chat/api/entities/chat';
import './ChatHeader.css';

interface ChatHeaderProps {
    chat: Chat;
    currentUserId?: string;
    presence?: PresenceStatus;
    onBackClick?: () => void;
    onInfoClick?: () => void;
    isDetailsOpen?: boolean;
};

const ChatHeader = ({
    chat,
    currentUserId,
    presence = PresenceStatus.Unknown,
    onBackClick,
    onInfoClick,
    isDetailsOpen = false
}: ChatHeaderProps) => {
    const displayName = getChatDisplayName(chat, currentUserId);
    const statusText = getChatStatusText(chat, presence);
    const infoLabel = isDetailsOpen ? 'Hide chat details' : 'Show chat details';

    return (
        <Container className='d-flex items-center content-between chat-header'>
            <Container className='d-flex items-center gap-1'>
                {onBackClick && (
                    <Tooltip content='Back to conversations'>
                        <IconButton
                            size='sm'
                            variant='ghost'
                            className='chat-header-mobile-button'
                            onClick={onBackClick}
                            title='Back to conversations'
                            aria-label='Back to conversations'
                        >
                            <IoArrowBackOutline size={20} />
                        </IconButton>
                    </Tooltip>
                )}

                <ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' />

                <Container className='d-flex column'>
                    <Paragraph className='font-size-3 font-weight-6 color-primary'>
                        {displayName}
                    </Paragraph>
                    {statusText && (
                        <Container className='d-flex items-center gap-05 chat-header-status'>
                            {!chat.isGroup && (
                                <StatusDot isOnline={presence === PresenceStatus.Online} />
                            )}
                            <Paragraph className='font-size-2 color-muted'>{statusText}</Paragraph>
                        </Container>
                    )}
                </Container>
            </Container>

            <Container className='d-flex items-center gap-05'>
                {onInfoClick && (
                    <Tooltip content={infoLabel}>
                        <IconButton
                            size='sm'
                            variant='ghost'
                            onClick={onInfoClick}
                            title={infoLabel}
                            aria-label={infoLabel}
                            aria-pressed={isDetailsOpen}
                        >
                            <IoInformationCircleOutline size={20} />
                        </IconButton>
                    </Tooltip>
                )}
            </Container>
        </Container>
    );
};

export default ChatHeader;
