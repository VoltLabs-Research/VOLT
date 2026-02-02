import { useState, useMemo } from 'react';
import { IoPersonAddOutline, IoPeopleOutline } from 'react-icons/io5';
import type { Chat } from '@/modules/chat/domain/entities';
import type { User } from '@/modules/auth/domain/entities';
import { ChatListItem, TeamMemberList } from '../../molecules';
import { ChatListSkeleton } from '../../atoms';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import EmptyState from '@/shared/presentation/components/EmptyState';
import SearchInput from '@/shared/presentation/components/SearchInput';
import './ChatSidebar.css';

interface ChatSidebarProps {
    chats: Chat[];
    currentChatId?: string;
    currentUserId?: string;
    teamMembers: User[];
    isLoading?: boolean;
    onSelectChat: (chatId: string) => void;
    onStartChatWithMember: (memberId: string) => void;
};

const ChatSidebar = ({
    chats,
    currentChatId,
    currentUserId,
    teamMembers,
    isLoading,
    onSelectChat,
    onStartChatWithMember
}: ChatSidebarProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showTeamMembers, setShowTeamMembers] = useState(false);

    const filteredChats = useMemo(() => {
        if (!searchQuery) return chats;
        
        return chats.filter((chat) => {
            if (chat.isGroup) {
                return chat.groupName?.toLowerCase().includes(searchQuery.toLowerCase());
            }
            const participant = chat.participants.find((p) => p._id !== currentUserId);
            if (!participant) return false;
            const name = `${participant.firstName} ${participant.lastName}`.toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        });
    }, [chats, searchQuery, currentUserId]);

    const handleMemberSelect = (memberId: string) => {
        onStartChatWithMember(memberId);
        setShowTeamMembers(false);
    };

    return (
        <Container className='d-flex column h-max chat-sidebar'>
            {/* Header */}
            <Container className='d-flex column gap-075 chat-sidebar-header'>
                <Container className='d-flex items-center content-between'>
                    <Paragraph className='font-size-5 font-weight-6 color-primary'>Messages</Paragraph>
                    <Container className='d-flex items-center gap-025'>
                        <Tooltip content='New Chat'>
                            <IconButton
                                size='sm'
                                variant='ghost'
                                onClick={() => setShowTeamMembers(!showTeamMembers)}
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
                            >
                                <IoPeopleOutline size={18} />
                            </IconButton>
                        </Tooltip>
                    </Container>
                </Container>

                {/* Search */}
                <SearchInput
                    placeholder='Search conversations...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </Container>

            {/* Team Members Section */}
            {showTeamMembers && (
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

            {/* Chat List */}
            <Container className='d-flex column flex-1 y-auto chat-sidebar-list'>
                {isLoading ? (
                    <ChatListSkeleton count={5} />
                ) : filteredChats.length === 0 ? (
                    <EmptyState
                        title='No conversations'
                        description={searchQuery ? 'No matches found' : 'Start a chat with a team member!'}
                    />
                ) : (
                    filteredChats.map((chat) => (
                        <ChatListItem
                            key={chat._id}
                            chat={chat}
                            currentUserId={currentUserId}
                            isActive={chat._id === currentChatId}
                            onClick={() => onSelectChat(chat._id)}
                        />
                    ))
                )}
            </Container>
        </Container>
    );
};

export default ChatSidebar;
