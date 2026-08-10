import type { ReactNode } from 'react';
import { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Button, SearchField, Skeleton, Tooltip } from '@heroui/react';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import ChatListItem from '../ChatListItem';
import TeamMemberList from '../TeamMemberList';
import { CREATE_GROUP_MODAL_ID } from '../CreateGroupModal';
import { openModal } from '@/shared/ui/modal';
import { matchesQuery } from '@/shared/utils/matches-query';
import type { User } from '@volt/contracts/modules/auth/domain';
import type { Chat } from '@volt/contracts/modules/chat/domain';

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

/*
 * `chat-sidebar` stays on the root because MessagesPage's state flags still drive
 * this pane's visibility; the rules that used to reach in from MessagesPage.css
 * are the two ancestor-flag variants at the end. Below 1024px an open details
 * panel replaces the list, and below 768px an open chat does.
 */
const SIDEBAR_CLASS_NAMES = 'flex flex-col h-full w-[320px] border-r border-border chat-sidebar max-[768px]:w-full max-[768px]:min-w-0 max-[768px]:border-r-0 max-[768px]:border-b max-[1024px]:[.messages-page--details-open_&]:hidden max-[768px]:[.messages-page--chat-open_&]:hidden';

/* bravais sized the header's icon buttons to the 44px touch target below 768px. */
const HEADER_BUTTON_CLASS_NAMES = 'max-[768px]:size-11';

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
                    <div className='flex flex-row items-center gap-3 p-3 rounded-lg border border-border bg-surface-tertiary cursor-default pointer-events-none' key={i} aria-hidden='true'>
                        <Skeleton className='size-10 rounded-full' />
                        <div className='flex flex-col gap-1 flex-1'>
                            <Skeleton className='h-3.5 w-30 rounded-xl' />
                            <Skeleton className='h-3 w-20 rounded-xl' />
                        </div>
                        <Skeleton className='size-2 rounded-full' />
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
            <RecoveryState
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
        <div className={SIDEBAR_CLASS_NAMES}>
            <div className='flex flex-col gap-3 px-6 py-4 border-b border-border max-[768px]:px-4 max-[768px]:py-3.5'>
                <div className='flex flex-row items-center justify-between'>
                    <p className='text-2xl font-semibold'>Messages</p>
                    <div className='flex flex-row items-center gap-1'>
                        <Tooltip>
                            <Button
                                size='sm'
                                variant='ghost'
                                isIconOnly
                                className={HEADER_BUTTON_CLASS_NAMES}
                                onPress={() => setShowTeamMembers(!showTeamMembers)}
                                aria-label={newChatTooltip}
                                isDisabled={teamMembers.length === 0}
                            >
                                <UserPlus size={18} />
                            </Button>
                            <Tooltip.Content>{newChatTooltip}</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                            <Button
                                size='sm'
                                variant='ghost'
                                isIconOnly
                                className={HEADER_BUTTON_CLASS_NAMES}
                                onPress={() => openModal(CREATE_GROUP_MODAL_ID)}
                                aria-label='Create Group'
                            >
                                <Users size={18} />
                            </Button>
                            <Tooltip.Content>Create Group</Tooltip.Content>
                        </Tooltip>
                    </div>
                </div>

                <SearchField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    aria-label='Search conversations'
                    fullWidth
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder='Search conversations...' />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
            </div>

            {showTeamMembers && teamMembers.length > 0 && (
                <div className='flex flex-col p-4'>
                    <p className='text-sm font-semibold text-muted p-3'>
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

            <div className='flex flex-col overflow-y-auto flex-1 p-2'>
                {chatListContent}
            </div>
        </div>
    );
};

export default ChatSidebar;
