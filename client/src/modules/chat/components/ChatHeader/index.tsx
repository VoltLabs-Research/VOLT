import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utils/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import { ArrowLeft, Info } from 'lucide-react';
import { IconButton, StatusDot, Tooltip } from '@voltstack/bravais';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import './ChatHeader.css';

interface ChatHeaderProps {
    chat: Chat;
    currentUserId?: string;
    presence?: PresenceStatus;
    onBackClick?: () => void;
    onInfoClick?: () => void;
    isDetailsOpen?: boolean;
}

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
        <div className='flex flex-row items-center justify-between chat-header'>
            <div className='flex flex-row items-center gap-4'>
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
                            <ArrowLeft size={20} />
                        </IconButton>
                    </Tooltip>
                )}

                <ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' />

                <div className='flex flex-col'>
                    <p className='text-base font-semibold'>
                        {displayName}
                    </p>
                    {statusText && (
                        <div className='flex flex-row items-center gap-2 chat-header-status'>
                            {!chat.isGroup && (
                                <StatusDot tone={presence === PresenceStatus.Online ? 'success' : 'neutral'} />
                            )}
                            <p className='text-sm text-muted'>{statusText}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className='flex flex-row items-center gap-2'>
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
                            <Info size={20} />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default ChatHeader;
