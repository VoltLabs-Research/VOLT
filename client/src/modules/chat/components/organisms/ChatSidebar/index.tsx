import type { ReactNode } from 'react';
import { useState, useMemo } from 'react';
import { IoPersonAddOutline, IoPeopleOutline } from 'react-icons/io5';
import EmptyState from '@/shared/presentation/components/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import ChatListSkeleton from '../../atoms/ChatListSkeleton';
import ChatListItem from '../../molecules/ChatListItem';
import TeamMemberList from '../../molecules/TeamMemberList';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import IconButton from '@/shared/presentation/components/IconButton';
import SearchInput from '@/shared/presentation/components/SearchInput';
import Tooltip from '@/shared/presentation/components/Tooltip';
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
        <Container className='d-flex column h-max chat-sidebar'>
            <Container className='d-flex column gap-075 chat-sidebar-header'>
                <Container className='d-flex items-center content-between'>
                    <Paragraph className='font-size-5 font-weight-6 color-primary'>Messages</Paragraph>
                    <Container className='d-flex items-center gap-025'>
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
                    </Container>
                </Container>

                <SearchInput
                    placeholder='Search conversations...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </Container>

            {showTeamMembers && availableTeamMembers.length > 0 && (
                <Container className='d-flex column p-1'>
                    <Paragraph className='font-size-2 font-weight-6 color-secondary chat-sidebar-section-title'>
                        Team Members
                    </Paragraph>
                    <TeamMemberList
                        members={teamMembers}
                        selectedIds={[]}
                        currentUserId={currentUserId}
                        onToggle={handleMemberSelect}
                    />
                </Container>
            )}

            <Container className='d-flex column flex-1 y-auto chat-sidebar-list'>
                {chatListContent}
            </Container>
        </Container>
    );
};

export default ChatSidebar;
