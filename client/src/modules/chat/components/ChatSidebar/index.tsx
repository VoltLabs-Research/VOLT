import type { ReactNode } from 'react';
import { useState, useMemo } from 'react';
import { IoPersonAddOutline, IoPeopleOutline } from 'react-icons/io5';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import ChatListSkeleton from '../ChatListSkeleton';
import ChatListItem from '../ChatListItem';
import TeamMemberList from '../TeamMemberList';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import SearchInput from '@/shared/presentation/primitives/SearchInput';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import { matchesQuery } from '@/shared/utils/matches-query';
import type { User } from '@/modules/auth/api/entities/user';
import type { Chat } from '@/modules/chat/api/entities/chat';
import './ChatSidebar.css';

interface ChatSidebarProps {
    chats: Chat[];
    currentChatId?: string;
    currentUserId?: string;
    teamMembers: User[];
    isLoading?: boolean;
    error?: Error | null;
    onSelectChat: (chatId: string) => void;
    onStartChatWithMember: (memberId: string) => void;
};

const ChatSidebar = ({
    chats,
    currentChatId,
    currentUserId,
    teamMembers,
    isLoading,
    error,
    onSelectChat,
    onStartChatWithMember
}: ChatSidebarProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showTeamMembers, setShowTeamMembers] = useState(false);
    let chatListContent: ReactNode;
    const availableTeamMembers = useMemo(() => {
        return teamMembers.filter((member) => member._id !== currentUserId);
    }, [teamMembers, currentUserId]);

    const filteredChats = useMemo(() => {
        return chats.filter((chat) => {
            if (chat.isGroup) {
                return matchesQuery(chat.groupName || '', searchQuery);
            }
            const participant = chat.participants.find((p) => p._id !== currentUserId);
            if (!participant) return false;
            const name = `${participant.firstName} ${participant.lastName}`;
            return matchesQuery(name, searchQuery);
        });
    }, [chats, searchQuery, currentUserId]);

    const handleMemberSelect = (memberId: string) => {
        onStartChatWithMember(memberId);
        setShowTeamMembers(false);
    };

    let newChatTooltip = 'New Chat';
    if (availableTeamMembers.length === 0) {
        newChatTooltip = 'No team members available';
    } else if (showTeamMembers) {
        newChatTooltip = 'Hide team members';
    }

    if (isLoading) {
        chatListContent = <ChatListSkeleton count={5} />;
    } else if (error && filteredChats.length === 0) {
        chatListContent = (
            <RecoveryState
                title='Unable to load chats'
                description={error.message || 'Something went wrong while loading conversations.'}
                tone={RecoveryStateTone.Error}
            />
        );
    } else if (filteredChats.length === 0) {
        let emptyDescription = 'Start a chat with a team member!';
        if (searchQuery) {
            emptyDescription = 'No matches found';
        } else if (availableTeamMembers.length === 0) {
            emptyDescription = 'Invite teammates to start chatting here.';
        }

        chatListContent = (
            <EmptyState
                title='No conversations'
                description={emptyDescription}
            />
        );
    } else {
        chatListContent = filteredChats.map((chat) => (
            <ChatListItem
                key={chat._id}
                chat={chat}
                currentUserId={currentUserId}
                isActive={chat._id === currentChatId}
                onClick={() => onSelectChat(chat._id)}
            />
        ));
    }

    return (
        <Stack height='max' className='chat-sidebar'>
            <Stack gap='075' className='chat-sidebar-header'>
                <Row justify='between'>
                    <Text as='p' size='2xl' weight='bold'>Messages</Text>
                    <Row gap='025'>
                        <Tooltip content={newChatTooltip}>
                            <IconButton
                                size='sm'
                                variant='ghost'
                                onClick={() => setShowTeamMembers(!showTeamMembers)}
                                title={newChatTooltip}
                                aria-label={newChatTooltip}
                                disabled={availableTeamMembers.length === 0}
                            >
                                <IoPersonAddOutline size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip content='Create Group'>
                            <IconButton
                                size='sm'
                                variant='ghost'
                                commandfor='create-group-modal'
                                command='show-modal'
                                title='Create Group'
                                aria-label='Create Group'
                            >
                                <IoPeopleOutline size={18} />
                            </IconButton>
                        </Tooltip>
                    </Row>
                </Row>

                <SearchInput
                    placeholder='Search conversations...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </Stack>

            {showTeamMembers && availableTeamMembers.length > 0 && (
                <Stack p='1'>
                    <Text as='p' size='md' weight='bold' tone='secondary' className='chat-sidebar-section-title'>
                        Team Members
                    </Text>
                    <TeamMemberList
                        members={teamMembers}
                        selectedIds={[]}
                        currentUserId={currentUserId}
                        onToggle={handleMemberSelect}
                    />
                </Stack>
            )}

            <Stack flex='1' overflow='y-auto' className='chat-sidebar-list'>
                {chatListContent}
            </Stack>
        </Stack>
    );
};

export default ChatSidebar;
