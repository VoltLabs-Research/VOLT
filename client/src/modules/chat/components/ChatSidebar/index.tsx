import type { ReactNode } from 'react';
import { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { EmptyState, Skeleton, IconButton, SearchInput, Tooltip } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import '../ChatListSkeleton/ChatListSkeleton.css';
import ChatListItem from '../ChatListItem';
import TeamMemberList from '../TeamMemberList';
import { CREATE_GROUP_MODAL_ID } from '../CreateGroupModal';
import { openModal } from '@/shared/ui/modal';
import { matchesQuery } from '@/shared/utils/matches-query';
import type { User } from '@volt/contracts/modules/auth/domain';
import type { Chat } from '@volt/contracts/modules/chat/domain';
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
}

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

    const filteredChats = chats.filter((chat) => {
        if (chat.isGroup) {
            return matchesQuery(chat.groupName || '', searchQuery);
        }

        const participant = chat.participants.find((p) => p._id !== currentUserId);
        if (!participant) return false;

        return matchesQuery(`${participant.firstName} ${participant.lastName}`, searchQuery);
    });

    const handleMemberSelect = (memberId: string) => {
        onStartChatWithMember(memberId);
        setShowTeamMembers(false);
    };

    let newChatTooltip = 'New Chat';
    if (teamMembers.length === 0) {
        newChatTooltip = 'No team members available';
    } else if (showTeamMembers) {
        newChatTooltip = 'Hide team members';
    }

    if (isLoading) {
        chatListContent = (
            <div className='flex flex-col gap-2'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div className='flex flex-row items-center gap-3 chat-skeleton-item' key={i}>
                        <Skeleton variant='circular' width={40} height={40} />
                        <div className='flex flex-col gap-1 flex-1'>
                            <Skeleton variant='rounded' width={120} height={14} />
                            <Skeleton variant='rounded' width={80} height={12} />
                        </div>
                        <Skeleton variant='circular' width={8} height={8} />
                    </div>
                ))}
            </div>
        );
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
        } else if (teamMembers.length === 0) {
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
        <div className='flex flex-col h-full chat-sidebar'>
            <div className='flex flex-col gap-3 chat-sidebar-header'>
                <div className='flex flex-row items-center justify-between'>
                    <p className='text-2xl font-semibold'>Messages</p>
                    <div className='flex flex-row items-center gap-1'>
                        <Tooltip content={newChatTooltip}>
                            <IconButton
                                size='sm'
                                variant='ghost'
                                onClick={() => setShowTeamMembers(!showTeamMembers)}
                                title={newChatTooltip}
                                aria-label={newChatTooltip}
                                disabled={teamMembers.length === 0}
                            >
                                <UserPlus size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip content='Create Group'>
                            <IconButton
                                size='sm'
                                variant='ghost'
                                onClick={() => openModal(CREATE_GROUP_MODAL_ID)}
                                title='Create Group'
                                aria-label='Create Group'
                            >
                                <Users size={18} />
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>

                <SearchInput
                    placeholder='Search conversations...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {showTeamMembers && teamMembers.length > 0 && (
                <div className='flex flex-col p-4'>
                    <p className='text-sm font-semibold text-muted chat-sidebar-section-title'>
                        Team Members
                    </p>
                    <TeamMemberList
                        members={teamMembers}
                        selectedIds={[]}
                        currentUserId={currentUserId}
                        onToggle={handleMemberSelect}
                    />
                </div>
            )}

            <div className='flex flex-col overflow-y-auto flex-1 chat-sidebar-list'>
                {chatListContent}
            </div>
        </div>
    );
};

export default ChatSidebar;
