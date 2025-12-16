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
        <div className='d-flex column chat-sidebar-container'>
            <div className='d-flex column gap-075 chat-sidebar-header-container'>
                <Title className='chat-sidebar-header-title'>Messages</Title>
                <div className='d-flex items-center gap-075 chat-sidebar-actions-row'>
                    <div className='d-flex items-center flex-1 chat-sidebar-search-container'>
                        <i className='d-flex flex-center chat-sidebar-search-icon-container'>
                            <IoSearchOutline />
                        </i>
                        <input
                            placeholder='Search people or messages...'
                            className='flex-1 chat-sidebar-search-input'
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
                <div className='chat-team-members-container'>
                    <Title className='font-size-3 chat-team-members-title'>Team Members</Title>
                    {teamMembers
                        .filter((member, index, self) =>
                            self.findIndex(m => m._id === member._id) === index
                        )
                        .map((member) => (
                            <div className='d-flex items-center chat-team-member-item'
                                onClick={() => {
                                    startChatWithMember(member);
                                    setShowTeamMembers(false);
                                }}
                            >
                                <div className='d-flex flex-center chat-team-member-avatar'>
                                    {getInitials(member.firstName, member.lastName)}
                                </div>
                                <div className='flex-1 chat-team-member-info'>
                                    <Title className='font-size-2-5 chat-team-member-name'>
                                        {member.firstName} {member.lastName}
                                    </Title>
                                    <Paragraph className='chat-team-member-email'>{member.email}</Paragraph>
                                </div>
                            </div>
                        ))}
                </div>
            )}

            <div className='flex-1 chat-conversations-container'>
                {isLoadingChats ? (
                    // Show skeleton while loading chats
                    Array.from({ length: 3 }).map((_, index) => (
                        <ChatListSkeleton key={`chat-skeleton-${index}`} />
                    ))
                ) : filteredChats.length === 0 ? (
                    <div className='d-flex column flex-center chat-empty-state'>
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
                            <div className={`d-flex items-center chat-conversation-item ${currentChat?._id === chat._id ? 'active' : ''}`}
                                onClick={() => selectChat(chat)}
                            >
                                <div className={`d-flex flex-center chat-conversation-avatar ${isGroup ? 'group-avatar' : ''}`}>
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
                                        <Title className='font-size-3 chat-conversation-name'>
                                            {displayName}
                                        </Title>
                                        {chat.lastMessageAt && (
                                            <span className='chat-conversation-time'>
                                                {formatTimeAgo(chat.lastMessageAt)}
                                            </span>
                                        )}
                                    </div>
                                    {chat.lastMessage && (
                                        <Paragraph className='chat-conversation-preview'>
                                            {chat.lastMessage.content}
                                        </Paragraph>
                                    )}
                                    {isGroup && (
                                        <div className='chat-conversation-meta'>
                                            <span className='chat-group-members-count'>
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
