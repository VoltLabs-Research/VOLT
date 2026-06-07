import { PresenceStatus } from '@/modules/chat/api/entities/shared/chat-events';
import { getChatDisplayName, getChatStatusText } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import SharedFilesList from '../SharedFilesList';
import { IoChatbubblesOutline, IoPeopleOutline } from 'react-icons/io5';
import { Box, Button, SectionLabel, Stack, Text, EmptyState } from '@voltstack/bravais';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import type { Chat } from '@/modules/chat/api/entities/chat';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import './ChatDetailsPanel.css';

interface ChatDetailsPanelProps {
    chat: Chat | null;
    messages: ChatMessage[];
    currentUserId?: string;
    presence?: PresenceStatus;
    onClose?: () => void;
}

const ChatDetailsPanel = ({
    chat,
    messages,
    currentUserId,
    presence = PresenceStatus.Unknown,
    onClose
}: ChatDetailsPanelProps) => {
    if (!chat) {
        return (
            <Stack height='max' className='chat-details'>
                <PanelHeader title='Details' />
                <Box display='flex' flex='1' className='flex-center'>
                    <EmptyState
                        icon={<IoChatbubblesOutline size={32} />}
                        title='No chat selected'
                        description='Select a conversation to view details'
                    />
                </Box>
            </Stack>
        );
    }

    const displayName = getChatDisplayName(chat, currentUserId);
    const statusText = getChatStatusText(chat, presence);

    let headerTitle = 'Contact Info';
    if (chat.isGroup) {
        headerTitle = 'Group Info';
    }

    return (
        <Stack height='max' className='chat-details'>
            <PanelHeader
                title={headerTitle}
                onClose={onClose}
                className='chat-details-header'
            />

            <Stack flex='1' overflow='y-auto' className='chat-details-content'>
                <Stack align='center' gap='075' textAlign='center' className='chat-details-section'>
                    <ChatAvatar
                        chat={chat}
                        currentUserId={currentUserId}
                        size='lg'
                        showStatus={!chat.isGroup}
                        isOnline={presence === PresenceStatus.Online}
                    />
                    <Text as='p' size='xl' weight='bold'>
                        {displayName}
                    </Text>
                    {statusText && (
                        <Text as='p' size='md' tone='muted'>{statusText}</Text>
                    )}
                    {chat.isGroup && chat.groupDescription && (
                        <Text as='p' size='md' tone='secondary'>
                            {chat.groupDescription}
                        </Text>
                    )}
                </Stack>

                {chat.isGroup && (
                    <Box className='chat-details-section'>
                        <SectionLabel className='chat-details-section-title d-block mb-075'>
                            Actions
                        </SectionLabel>
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
                    </Box>
                )}

                <Box className='chat-details-section'>
                    <SectionLabel className='chat-details-section-title d-block mb-075'>
                        Shared Files
                    </SectionLabel>
                    <SharedFilesList messages={messages} />
                </Box>
            </Stack>
        </Stack>
    );
};

export default ChatDetailsPanel;
