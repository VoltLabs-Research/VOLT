import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import { IoArrowBackOutline, IoInformationCircleOutline } from 'react-icons/io5';
import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
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
        <div className='volt-container d-flex items-center content-between chat-header'>
            <div className='volt-container d-flex items-center gap-1'>
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

                <div className='volt-container d-flex column'>
                    <p className='volt-text font-size-3 font-weight-6 color-primary'>
                        {displayName}
                    </p>
                    {statusText && (
                        <div className='volt-container d-flex items-center gap-05 chat-header-status'>
                            {!chat.isGroup && (
                                <StatusDot isOnline={presence === PresenceStatus.Online} />
                            )}
                            <p className='volt-text font-size-2 color-muted'>{statusText}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className='volt-container d-flex items-center gap-05'>
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
            </div>
        </div>
    );
};

export default ChatHeader;
