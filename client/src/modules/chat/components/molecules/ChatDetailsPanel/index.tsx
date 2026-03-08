import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../../atoms/ChatAvatar';
import SharedFilesList from '../SharedFilesList';
import { IoChatbubblesOutline, IoPeopleOutline } from 'react-icons/io5';
import Button from '@/shared/presentation/components/Button';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import './ChatDetailsPanel.css';

interface ChatDetailsPanelProps {
    chat: Chat | null;
    messages: ChatMessage[];
    currentUserId?: string;
    presence?: PresenceStatus;
};

const ChatDetailsPanel = ({
    chat,
    messages,
    currentUserId,
    presence = PresenceStatus.Unknown
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
            <Container className='chat-details-header'>
                <Paragraph className='font-size-4 font-weight-6 color-primary'>
                    {chat.isGroup ? 'Group Info' : 'Contact Info'}
                </Paragraph>
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
