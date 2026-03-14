import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../../atoms/ChatAvatar';
import SharedFilesList from '../SharedFilesList';
import { IoChatbubblesOutline, IoCloseOutline, IoPeopleOutline } from 'react-icons/io5';
import Button from '@/shared/presentation/components/Button';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
            <Container className='d-flex column h-max chat-details'>
                <Container className='chat-details-header'>
                    <Paragraph className='font-size-4 font-weight-6 color-primary'>Details</Paragraph>
                </Container>
                <Container className='d-flex flex-center flex-1'>
                    <EmptyState
                        icon={<IoChatbubblesOutline size={32} />}
                        title='No chat selected'
                        description='Select a conversation to view details'
                    />
                </Container>
            </Container>
        );
    }

    const displayName = getChatDisplayName(chat, currentUserId);
    const statusText = getChatStatusText(chat, presence);

    return (
        <Container className='d-flex column h-max chat-details'>
            <Container className='d-flex items-center content-between chat-details-header'>
                <Paragraph className='font-size-4 font-weight-6 color-primary'>
                    {chat.isGroup ? 'Group Info' : 'Contact Info'}
                </Paragraph>
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
            </Container>

            <Container className='d-flex column flex-1 y-auto chat-details-content'>
                <Container className='d-flex column items-center gap-075 text-center chat-details-section'>
                    <ChatAvatar 
                        chat={chat} 
                        currentUserId={currentUserId} 
                        size='lg'
                        showStatus={!chat.isGroup}
                        isOnline={presence === PresenceStatus.Online}
                    />
                    <Paragraph className='font-size-4 font-weight-6 color-primary'>
                        {displayName}
                    </Paragraph>
                    {statusText && (
                        <Paragraph className='font-size-2 color-muted'>{statusText}</Paragraph>
                    )}
                    {chat.isGroup && chat.groupDescription && (
                        <Paragraph className='font-size-2 color-secondary'>
                            {chat.groupDescription}
                        </Paragraph>
                    )}
                </Container>

                {chat.isGroup && (
                    <Container className='chat-details-section'>
                        <Paragraph className='font-size-2 font-weight-6 color-secondary chat-details-section-title d-block'>
                            Actions
                        </Paragraph>
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
                    </Container>
                )}

                <Container className='chat-details-section'>
                    <Paragraph className='font-size-2 font-weight-6 color-secondary chat-details-section-title d-block'>
                        Shared Files
                    </Paragraph>
                    <SharedFilesList messages={messages} />
                </Container>
            </Container>
        </Container>
    );
};

export default ChatDetailsPanel;
