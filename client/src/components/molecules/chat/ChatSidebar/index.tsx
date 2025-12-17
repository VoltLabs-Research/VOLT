import React, { useState } from 'react';
import { IoSearchOutline, IoPersonAddOutline, IoPeopleOutline } from 'react-icons/io5';
import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/chat';
import { getInitials } from '@/utilities/guest';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import ChatListSkeleton from '@/components/atoms/chat/messages/ChatListSkeleton';
import useAuthStore from '@/stores/authentication';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import Button from '@/components/primitives/Button';
import './ChatSidebar.css';

const ChatSidebar: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showTeamMembers, setShowTeamMembers] = useState(false);

    const user = useAuthStore((store) => store.user);
    const { teamMembers, startChatWithMember, chats, isLoadingChats, selectChat, currentChat } = useChat();
    const { setShowCreateGroup } = useChatStore();

    // Filter chats based on search query
    const filteredChats = chats.filter(chat => {
        if (!searchQuery) return true;
        const participant = chat.participants.find(p => p._id !== user?._id);
        if (!participant) return false;
        const name = `${participant.firstName} ${participant.lastName}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    return (
        <div className='d-flex column chat-sidebar-container p-relative'>
            <div className='d-flex column gap-075 chat-sidebar-header-container p-relative'>
                <Title className='chat-sidebar-header-title font-size-5 font-weight-6 color-primary'>Messages</Title>
                <div className='d-flex items-center gap-075 chat-sidebar-actions-row'>
                    <div className='d-flex items-center flex-1 chat-sidebar-search-container p-relative overflow-hidden'>
                        <i className='d-flex flex-center chat-sidebar-search-icon-container color-secondary'>
                            <IoSearchOutline />
                        </i>
                        <input
                            placeholder='Search people or messages...'
                            className='flex-1 chat-sidebar-search-input font-size-2-5 color-primary'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        iconOnly
                        size='sm'
                        onClick={() => setShowTeamMembers(!showTeamMembers)}
                        title='Start new chat'
                    >
                        <IoPersonAddOutline />
                    </Button>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        iconOnly
                        size='sm'
                        commandfor='create-group-modal'
                        command='showModal'
                        title='Create group'
                    >
                        <IoPeopleOutline />
                    </Button>
                </div>
            </div>

            {/* Team Members for New Chat */}
            {showTeamMembers && (
                <div className='chat-team-members-container y-auto'>
                    <Title className='font-size-1 chat-team-members-title font-weight-6 color-secondary'>Team Members</Title>
                    {teamMembers
                        .filter((member, index, self) =>
                            self.findIndex(m => m._id === member._id) === index
                        )
                        .map((member) => (
                            <div className='d-flex items-center chat-team-member-item cursor-pointer'
                                onClick={() => {
                                    startChatWithMember(member);
                                    setShowTeamMembers(false);
                                }}
                            >
                                <div className='d-flex flex-center chat-team-member-avatar f-shrink-0 font-weight-6'>
                                    {getInitials(member.firstName, member.lastName)}
                                </div>
                                <div className='flex-1 chat-team-member-info'>
                                    <Title className='font-size-2-5 chat-team-member-name font-weight-6 color-primary'>
                                        {member.firstName} {member.lastName}
                                    </Title>
                                    <Paragraph className='chat-team-member-email overflow-hidden color-muted'>{member.email}</Paragraph>
                                </div>
                            </div>
                        ))}
                </div>
            )}

            <div className='flex-1 chat-conversations-container y-auto'>
                {isLoadingChats ? (
                    // Show skeleton while loading chats
                    Array.from({ length: 3 }).map((_, index) => (
                        <ChatListSkeleton key={`chat-skeleton-${index}`} />
                    ))
                ) : filteredChats.length === 0 ? (
                    <div className='d-flex column flex-center chat-empty-state h-max text-center color-secondary'>
                        <Paragraph>No conversations yet</Paragraph>
                        <Paragraph>Start a chat with a team member!</Paragraph>
                    </div>
                ) : (
                    filteredChats.map((chat) => {
                        const isGroup = chat.isGroup;
                        const displayName = isGroup ? chat.groupName :
                            chat.participants.find(p => p._id !== user?._id)?.firstName + ' ' +
                            chat.participants.find(p => p._id !== user?._id)?.lastName;

                        if (!displayName) return null;

                        return (
                            <div className={`d-flex items-center chat-conversation-item ${currentChat?._id === chat._id ? 'active' : ''} p-relative cursor-pointer`}
                                onClick={() => selectChat(chat)}
                            >
                                <div className={`d-flex flex-center chat-conversation-avatar ${isGroup ? 'group-avatar' : ''} f-shrink-0 font-weight-6`}>
                                    {isGroup ? (
                                        <IoPeopleOutline />
                                    ) : (
                                        getInitials(
                                            chat.participants.find(p => p._id !== user?._id)?.firstName || '',
                                            chat.participants.find(p => p._id !== user?._id)?.lastName || ''
                                        )
                                    )}
                                </div>
                                <div className='flex-1 chat-conversation-content'>
                                    <div className='d-flex items-center content-between chat-conversation-header'>
                                        <Title className='font-size-3 chat-conversation-name font-size-2-5 font-weight-6 color-primary'>
                                            {displayName}
                                        </Title>
                                        {chat.lastMessageAt && (
                                            <span className='chat-conversation-time font-weight-5 color-muted'>
                                                {formatTimeAgo(chat.lastMessageAt)}
                                            </span>
                                        )}
                                    </div>
                                    {chat.lastMessage && (
                                        <Paragraph className='chat-conversation-preview overflow-hidden color-secondary'>
                                            {chat.lastMessage.content}
                                        </Paragraph>
                                    )}
                                    {isGroup && (
                                        <div className='chat-conversation-meta'>
                                            <span className='chat-group-members-count font-size-1 font-weight-5 color-muted'>
                                                {chat.participants.length} members
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChatSidebar;
