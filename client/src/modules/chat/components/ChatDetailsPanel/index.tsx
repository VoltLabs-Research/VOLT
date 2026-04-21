import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import SharedFilesList from '../SharedFilesList';
import { IoChatbubblesOutline, IoCloseOutline, IoPeopleOutline } from 'react-icons/io5';
import Button from '@/shared/presentation/components/Button';
import EmptyState from '@/shared/presentation/components/EmptyState';
import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import './ChatDetailsPanel.css';

interface ChatDetailsPanelProps {
    chat: Chat | null;
    messages: ChatMessage[];
    currentUserId?: string;
    presence?: PresenceStatus;
    onClose?: () => void;
};

const ChatDetailsPanel = ({
    chat,
    messages,
    currentUserId,
    presence = PresenceStatus.Unknown,
    onClose
}: ChatDetailsPanelProps) => {
    if (!chat) {
        return (
            <div className='volt-container d-flex column h-max chat-details'>
                <div className='volt-container chat-details-header'>
                    <p className='volt-text font-size-4 font-weight-6 color-primary'>Details</p>
                </div>
                <div className='volt-container d-flex flex-center flex-1'>
                    <EmptyState
                        icon={<IoChatbubblesOutline size={32} />}
                        title='No chat selected'
                        description='Select a conversation to view details'
                    />
                </div>
            </div>
        );
    }

    const displayName = getChatDisplayName(chat, currentUserId);
    const statusText = getChatStatusText(chat, presence);

    return (
        <div className='volt-container d-flex column h-max chat-details'>
            <div className='volt-container d-flex items-center content-between chat-details-header'>
                <p className='volt-text font-size-4 font-weight-6 color-primary'>
                    {chat.isGroup ? 'Group Info' : 'Contact Info'}
                </p>
                {onClose && (
                    <Tooltip content='Close details'>
                        <IconButton
                            size='sm'
                            variant='ghost'
                            className='chat-details-close-button'
                            onClick={onClose}
                            title='Close details'
                            aria-label='Close details'
                        >
                            <IoCloseOutline size={20} />
                        </IconButton>
                    </Tooltip>
                )}
            </div>

            <div className='volt-container d-flex column flex-1 y-auto chat-details-content'>
                <div className='volt-container d-flex column items-center gap-075 text-center chat-details-section'>
                    <ChatAvatar 
                        chat={chat} 
                        currentUserId={currentUserId} 
                        size='lg'
                        showStatus={!chat.isGroup}
                        isOnline={presence === PresenceStatus.Online}
                    />
                    <p className='volt-text font-size-4 font-weight-6 color-primary'>
                        {displayName}
                    </p>
                    {statusText && (
                        <p className='volt-text font-size-2 color-muted'>{statusText}</p>
                    )}
                    {chat.isGroup && chat.groupDescription && (
                        <p className='volt-text font-size-2 color-secondary'>
                            {chat.groupDescription}
                        </p>
                    )}
                </div>

                {chat.isGroup && (
                    <div className='volt-container chat-details-section'>
                        <p className='volt-text font-size-2 font-weight-6 color-secondary chat-details-section-title d-block'>
                            Actions
                        </p>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            leftIcon={<IoPeopleOutline />}
                            block
                            align='start'
                            commandfor='group-management-modal'
                            command='show-modal'
                        >
                            Manage Group
                        </Button>
                    </div>
                )}

                <div className='volt-container chat-details-section'>
                    <p className='volt-text font-size-2 font-weight-6 color-secondary chat-details-section-title d-block'>
                        Shared Files
                    </p>
                    <SharedFilesList messages={messages} />
                </div>
            </div>
        </div>
    );
};

export default ChatDetailsPanel;
