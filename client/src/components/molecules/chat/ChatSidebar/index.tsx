import React, { useState } from 'react';
import { IoSearchOutline, IoPersonAddOutline, IoPeopleOutline } from 'react-icons/io5';
import { useChat } from '@/hooks/chat/useChat';
import { useChatStore } from '@/stores/chat';
import { getInitials } from '@/utilities/guest';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import ChatListSkeleton from '@/components/atoms/messages/ChatListSkeleton';
import useAuthStore from '@/stores/authentication';

const ChatSidebar: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showTeamMembers, setShowTeamMembers] = useState(false);

    const user = useAuthStore((store) => store.user);
    const { teamMembers, startChatWithMember, chats, isLoading, selectChat, currentChat } = useChat();
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
        <div className='chat-sidebar-container'>
            <div className='chat-sidebar-header-container'>
                <h3 className='chat-sidebar-header-title'>Messages</h3>
                <div className='chat-sidebar-actions-row'>
                    <div className='chat-sidebar-search-container'>
                        <i className='chat-sidebar-search-icon-container'>
                            <IoSearchOutline />
                        </i>
                        <input 
                            placeholder='Search people or messages...'
                            className='chat-sidebar-search-input'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button 
                        className='chat-new-chat-button'
                        onClick={() => setShowTeamMembers(!showTeamMembers)}
                        title='Start new chat'
                    >
                        <IoPersonAddOutline />
                    </button>
                    <button 
                        className='chat-new-group-button'
                        onClick={() => setShowCreateGroup(true)}
                        title='Create group'
                    >
                        <IoPeopleOutline />
                    </button>
                </div>
            </div>

            {/* Team Members for New Chat */}
            {showTeamMembers && (
                <div className='chat-team-members-container'>
                    <h4 className='chat-team-members-title'>Team Members</h4>
                    {teamMembers
                        .filter((member, index, self) => 
                            self.findIndex(m => m._id === member._id) === index
                        )
                        .map((member) => (
                        <div 
                            key={member._id} 
                            className='chat-team-member-item'
                            onClick={() => {
                                startChatWithMember(member);
                                setShowTeamMembers(false);
                            }}
                        >
                            <div className='chat-team-member-avatar'>
                                {getInitials(member.firstName, member.lastName)}
                            </div>
                            <div className='chat-team-member-info'>
                                <h5 className='chat-team-member-name'>
                                    {member.firstName} {member.lastName}
                                </h5>
                                <p className='chat-team-member-email'>{member.email}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className='chat-conversations-container'>
                {isLoading ? (
                    // Show skeleton while loading chats
                    Array.from({ length: 3 }).map((_, index) => (
                        <ChatListSkeleton key={`chat-skeleton-${index}`} />
                    ))
                ) : filteredChats.length === 0 ? (
                    <div className='chat-empty-state'>
                        <p>No conversations yet</p>
                        <p>Start a chat with a team member!</p>
                    </div>
                ) : (
                    filteredChats.map((chat) => {
                        const isGroup = chat.isGroup;
                        const displayName = isGroup ? chat.groupName : 
                            chat.participants.find(p => p._id !== user?._id)?.firstName + ' ' + 
                            chat.participants.find(p => p._id !== user?._id)?.lastName;
                        
                        if (!displayName) return null;

                        return (
                            <div 
                                key={chat._id} 
                                className={`chat-conversation-item ${currentChat?._id === chat._id ? 'active' : ''}`}
                                onClick={() => selectChat(chat)}
                            >
                                <div className={`chat-conversation-avatar ${isGroup ? 'group-avatar' : ''}`}>
                                    {isGroup ? (
                                        <IoPeopleOutline />
                                    ) : (
                                        getInitials(
                                            chat.participants.find(p => p._id !== user?._id)?.firstName || '',
                                            chat.participants.find(p => p._id !== user?._id)?.lastName || ''
                                        )
                                    )}
                                </div>
                                <div className='chat-conversation-content'>
                                    <div className='chat-conversation-header'>
                                        <h4 className='chat-conversation-name'>
                                            {displayName}
                                        </h4>
                                        {chat.lastMessageAt && (
                                            <span className='chat-conversation-time'>
                                                {formatTimeAgo(chat.lastMessageAt)}
                                            </span>
                                        )}
                                    </div>
                                    {chat.lastMessage && (
                                        <p className='chat-conversation-preview'>
                                            {chat.lastMessage.content}
                                        </p>
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