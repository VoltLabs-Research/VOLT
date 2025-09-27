/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useState, useRef, useEffect } from 'react';
import DashboardContainer from '@/components/atoms/DashboardContainer';
import { 
    IoSearchOutline, 
    IoCallOutline, 
    IoVideocamOutline, 
    IoInformationCircleOutline,
    IoEllipsisVerticalOutline,
    IoPaperPlaneOutline,
    IoAttachOutline,
    IoHappyOutline,
    IoPersonAddOutline
} from 'react-icons/io5';
import { useChat } from '@/hooks/chat/useChat';
import useAuthStore from '@/stores/authentication';
import { formatDistanceToNow } from 'date-fns';
import './Messages.css';

const MessagesPage = () => {
    const {
        chats,
        currentChat,
        messages,
        teamMembers,
        typingUsers,
        isLoading,
        isConnected,
        selectChat,
        startChatWithMember,
        handleSendMessage,
        handleTyping,
    } = useChat();

    const { user } = useAuthStore();
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTeamMembers, setShowTeamMembers] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Filter chats based on search query
    const filteredChats = chats.filter(chat => {
        if (!searchQuery) return true;
        const participant = chat.participants.find(p => p._id !== user?._id);
        if (!participant) return false;
        const name = `${participant.firstName} ${participant.lastName}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    // Get the other participant in the current chat
    const currentParticipant = currentChat?.participants.find(p => p._id !== user?._id);

    // Handle sending a message
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim()) return;

        await handleSendMessage(messageInput);
        setMessageInput('');
    };

    // Handle typing
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageInput(e.target.value);
        if (currentChat) {
            handleTyping(currentChat._id);
        }
    };

    // Format time for display
    const formatTime = (dateString: string) => {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    };

    // Get initials for avatar
    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    return (
        <DashboardContainer pageName='Messages' className='chat-main-container'>
            {/* Sidebar */}
            <div className='chat-sidebar-container'>
                <div className='chat-sidebar-header-container'>
                    <h3 className='chat-sidebar-header-title'>Chat</h3>
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
                </div>

                {/* Team Members for New Chat */}
                {showTeamMembers && (
                    <div className='chat-team-members-container'>
                        <h4 className='chat-team-members-title'>Team Members</h4>
                        {teamMembers.map((member) => (
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
                        <div className='chat-loading'>Loading chats...</div>
                    ) : filteredChats.length === 0 ? (
                        <div className='chat-empty-state'>
                            <p>No conversations yet</p>
                            <p>Start a chat with a team member!</p>
                        </div>
                    ) : (
                        filteredChats.map((chat) => {
                            const participant = chat.participants.find(p => p._id !== user?._id);
                            if (!participant) return null;

                            return (
                                <div 
                                    key={chat._id} 
                                    className={`chat-conversation-item ${currentChat?._id === chat._id ? 'active' : ''}`}
                                    onClick={() => selectChat(chat)}
                                >
                                    <div className='chat-conversation-avatar'>
                                        {getInitials(participant.firstName, participant.lastName)}
                                    </div>
                                    <div className='chat-conversation-content'>
                                        <div className='chat-conversation-header'>
                                            <h4 className='chat-conversation-name'>
                                                {participant.firstName} {participant.lastName}
                                            </h4>
                                            {chat.lastMessageAt && (
                                                <span className='chat-conversation-time'>
                                                    {formatTime(chat.lastMessageAt)}
                                                </span>
                                            )}
                                        </div>
                                        {chat.lastMessage && (
                                            <p className='chat-conversation-preview'>
                                                {chat.lastMessage.content}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className='chat-messages-container'>
                {currentChat ? (
                    <div className='chat-box-container'>
                        {/* Chat Header */}
                        <div className='chat-box-header-container'>
                            <div className='chat-header-user'>
                                <div className='chat-header-avatar'>
                                    {currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'}
                                </div>
                                <div className='chat-header-info'>
                                    <h3 className='chat-header-name'>
                                        {currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName}` : 'Unknown'}
                                    </h3>
                                    <div className='chat-header-status'>
                                        {isConnected ? 'Online' : 'Connecting...'}
                                    </div>
                                </div>
                            </div>
                            <div className='chat-header-actions'>
                                <button className='chat-header-action' title='Call'>
                                    <IoCallOutline />
                                </button>
                                <button className='chat-header-action' title='Video Call'>
                                    <IoVideocamOutline />
                                </button>
                                <button className='chat-header-action' title='More Options'>
                                    <IoEllipsisVerticalOutline />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className='chat-box-messages-container'>
                            {isLoading ? (
                                <div className='chat-loading'>Loading messages...</div>
                            ) : messages.length === 0 ? (
                                <div className='chat-empty-messages'>
                                    <p>No messages yet</p>
                                    <p>Start the conversation!</p>
                                </div>
                            ) : (
                                messages.map((message) => {
                                    const isSent = message.sender._id === user?._id;
                                    return (
                                        <div key={message._id} className={`chat-message ${isSent ? 'sent' : 'received'}`}>
                                            <div className='chat-message-avatar'>
                                                {isSent ? 'You' : getInitials(message.sender.firstName, message.sender.lastName)}
                                            </div>
                                            <div className='chat-message-content'>
                                                <p className='chat-message-text'>{message.content}</p>
                                                <div className='chat-message-time'>
                                                    {formatTime(message.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            
                            {/* Typing Indicator */}
                            {typingUsers.length > 0 && (
                                <div className='chat-message received'>
                                    <div className='chat-message-avatar'>?</div>
                                    <div className='chat-typing-indicator'>
                                        <div className='chat-typing-dots'>
                                            <div className='chat-typing-dot'></div>
                                            <div className='chat-typing-dot'></div>
                                            <div className='chat-typing-dot'></div>
                                        </div>
                                        <span className='chat-typing-text'>
                                            {typingUsers.map(u => u.userName).join(', ')} typing...
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <form onSubmit={handleSend} className='chat-input-container'>
                            <div className='chat-input-wrapper'>
                                <button type='button' className='chat-header-action' title='Attach File'>
                                    <IoAttachOutline />
                                </button>
                                <textarea 
                                    className='chat-input'
                                    placeholder='Type a message...'
                                    rows={1}
                                    value={messageInput}
                                    onChange={handleInputChange}
                                />
                                <button type='button' className='chat-header-action' title='Emoji'>
                                    <IoHappyOutline />
                                </button>
                                <button type='submit' className='chat-send-button' title='Send Message' disabled={!messageInput.trim()}>
                                    <IoPaperPlaneOutline />
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className='chat-welcome-container'>
                        <div className='chat-welcome-content'>
                            <h2>Welcome to Chat</h2>
                            <p>Select a conversation or start a new chat with a team member</p>
                            {!isConnected && (
                                <div className='chat-connection-status'>
                                    <p>Connecting to chat service...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Details Panel */}
                <div className='chat-details-container'>
                    <div className='chat-details-header'>
                        <h3 className='chat-details-title'>Contact Info</h3>
                    </div>
                    
                    <div className='chat-details-content'>
                        <div className='chat-details-section'>
                            <div className='chat-details-user-info'>
                                <div className='chat-details-avatar'>SC</div>
                                <h4 className='chat-details-name'>Dr. Sarah Chen</h4>
                                <div className='chat-details-status'>Online</div>
                            </div>
                        </div>

                        <div className='chat-details-section'>
                            <h4 className='chat-details-section-title'>Actions</h4>
                            <div className='chat-details-actions'>
                                <button className='chat-details-action'>
                                    <i className='chat-details-action-icon'>
                                        <IoCallOutline />
                                    </i>
                                    <span className='chat-details-action-text'>Voice Call</span>
                                </button>
                                <button className='chat-details-action'>
                                    <i className='chat-details-action-icon'>
                                        <IoVideocamOutline />
                                    </i>
                                    <span className='chat-details-action-text'>Video Call</span>
                                </button>
                                <button className='chat-details-action'>
                                    <i className='chat-details-action-icon'>
                                        <IoInformationCircleOutline />
                                    </i>
                                    <span className='chat-details-action-text'>View Profile</span>
                                </button>
                            </div>
                        </div>

                        <div className='chat-details-section'>
                            <h4 className='chat-details-section-title'>Shared Files</h4>
                            <div className='chat-empty-state'>
                                <div className='chat-empty-description'>
                                    No shared files yet
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardContainer>
    )
};

export default MessagesPage;