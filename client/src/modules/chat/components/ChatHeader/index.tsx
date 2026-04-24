import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import { IoArrowBackOutline, IoInformationCircleOutline } from 'react-icons/io5';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import StatusDot from '@/shared/presentation/primitives/StatusDot';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
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
        <Row justify='between' className='chat-header'>
            <Row gap='1'>
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

                <Stack>
                    <Text as='p' size='lg' weight='bold'>
                        {displayName}
                    </Text>
                    {statusText && (
                        <Row gap='05' className='chat-header-status'>
                            {!chat.isGroup && (
                                <StatusDot isOnline={presence === PresenceStatus.Online} />
                            )}
                            <Text as='p' size='md' tone='muted'>{statusText}</Text>
                        </Row>
                    )}
                </Stack>
            </Row>

            <Row gap='05'>
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
            </Row>
        </Row>
    );
};

export default ChatHeader;
