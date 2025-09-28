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
    IoPersonAddOutline,
    IoPeopleOutline,
    IoAddOutline,
    IoCloseOutline,
    IoCheckmarkOutline,
    IoTrashOutline,
    IoCreateOutline,
    IoPersonRemoveOutline,
    IoImageOutline,
    IoDocumentOutline,
    IoDownloadOutline,
    IoCloseCircleOutline
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
        createGroupChat,
        addUsersToGroup,
        removeUsersFromGroup,
        updateGroupInfo,
        leaveGroup,
        sendFileMessage
    } = useChat();

    const { user } = useAuthStore();
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTeamMembers, setShowTeamMembers] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showGroupManagement, setShowGroupManagement] = useState(false);
    const [showEditGroup, setShowEditGroup] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupDescription, setEditGroupDescription] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [filePreviews, setFilePreviews] = useState<{file: File, preview: string}[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

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
        if (!messageInput.trim() && selectedFiles.length === 0) return;

        if (selectedFiles.length > 0) {
            await handleFileUpload();
        }
        
        if (messageInput.trim()) {
            await handleSendMessage(messageInput);
            setMessageInput('');
        }
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

    // Format file size
    const formatFileSize = (bytes: number | undefined) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Group management functions
    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;
        
        try {
            await createGroupChat(
                currentChat?.team._id || '',
                groupName.trim(),
                groupDescription.trim(),
                selectedMembers
            );
            setShowCreateGroup(false);
            setGroupName('');
            setGroupDescription('');
            setSelectedMembers([]);
        } catch (error) {
            console.error('Failed to create group:', error);
        }
    };

    const handleAddMembers = async () => {
        if (selectedMembers.length === 0 || !currentChat) return;
        
        try {
            await addUsersToGroup(currentChat._id, selectedMembers);
            setShowAddMembers(false);
            setSelectedMembers([]);
        } catch (error) {
            console.error('Failed to add members:', error);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!currentChat) return;
        
        try {
            await removeUsersFromGroup(currentChat._id, [memberId]);
        } catch (error) {
            console.error('Failed to remove member:', error);
        }
    };

    const handleUpdateGroupInfo = async () => {
        if (!currentChat) return;
        
        try {
            await updateGroupInfo(
                currentChat._id,
                editGroupName.trim() || undefined,
                editGroupDescription.trim() || undefined
            );
            setShowEditGroup(false);
        } catch (error) {
            console.error('Failed to update group info:', error);
        }
    };

    const handleLeaveGroup = async () => {
        if (!currentChat) return;
        
        try {
            await leaveGroup(currentChat._id);
            setShowGroupManagement(false);
        } catch (error) {
            console.error('Failed to leave group:', error);
        }
    };

    const toggleMemberSelection = (memberId: string) => {
        setSelectedMembers(prev => 
            prev.includes(memberId) 
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const openEditGroup = () => {
        if (currentChat) {
            setEditGroupName(currentChat.groupName || '');
            setEditGroupDescription(currentChat.groupDescription || '');
            setShowEditGroup(true);
        }
    };

    const openAddMembers = () => {
        setSelectedMembers([]);
        setShowAddMembers(true);
    };

    // File handling functions
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...selectedFiles, ...files];
        setSelectedFiles(newFiles);

        // Generate previews for images
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = e.target?.result as string;
                setFilePreviews(prev => [...prev, { file, preview }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeFile = (index: number) => {
        const fileToRemove = selectedFiles[index];
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setFilePreviews(prev => prev.filter(item => item.file !== fileToRemove));
    };

    const handleFileUpload = async () => {
        if (selectedFiles.length === 0 || !currentChat) return;

        setIsUploading(true);
        try {
            for (const file of selectedFiles) {
                await sendFileMessage(file);
            }
            setSelectedFiles([]);
            setFilePreviews([]);
        } catch (error) {
            console.error('Failed to upload files:', error);
        } finally {
            setIsUploading(false);
        }
    };

    // Emoji handling functions
    const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

    const insertEmoji = (emoji: string) => {
        setMessageInput(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <DashboardContainer pageName='Messages' className='chat-main-container'>
            {/* Sidebar */}
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
                                                    {formatTime(chat.lastMessageAt)}
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

            {/* Main Chat Area */}
            <div className='chat-messages-container'>
                {currentChat ? (
                    <div className='chat-box-container'>
                        {/* Chat Header */}
                        <div className='chat-box-header-container'>
                            <div className='chat-header-user'>
                                <div className={`chat-header-avatar ${currentChat?.isGroup ? 'group-avatar' : ''}`}>
                                    {currentChat?.isGroup ? (
                                        <IoPeopleOutline />
                                    ) : (
                                        currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'
                                    )}
                                </div>
                                <div className='chat-header-info'>
                                    <h3 className='chat-header-name'>
                                        {currentChat?.isGroup 
                                            ? currentChat.groupName 
                                            : currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName}` : 'Unknown'
                                        }
                                    </h3>
                                    <div className='chat-header-status'>
                                        {currentChat?.isGroup 
                                            ? `${currentChat.participants.length} members`
                                            : isConnected ? 'Online' : 'Connecting...'
                                        }
                                    </div>
                                </div>
                            </div>
                            <div className='chat-header-actions'>
                                {currentChat?.isGroup && (
                                    <button 
                                        className='chat-header-action' 
                                        title='Group Management'
                                        onClick={() => setShowGroupManagement(true)}
                                    >
                                        <IoEllipsisVerticalOutline />
                                    </button>
                                )}
                                <button className='chat-header-action' title='Call'>
                                    <IoCallOutline />
                                </button>
                                <button className='chat-header-action' title='Video Call'>
                                    <IoVideocamOutline />
                                </button>
                                <button className='chat-header-action' title='More Options'>
                                    <IoInformationCircleOutline />
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
                                                {message.messageType === 'file' && message.metadata ? (
                                                    <div className='chat-file-message'>
                                                        {message.metadata.fileType?.startsWith('image/') ? (
                                                            <div className='chat-image-message'>
                                                                <img 
                                                                    src={message.metadata.fileUrl} 
                                                                    alt={message.metadata.fileName}
                                                                    className='chat-image-preview'
                                                                />
                                                                <div className='chat-file-info'>
                                                                    <div className='chat-file-icon'>
                                                                        <IoImageOutline />
                                                                    </div>
                                                                    <div className='chat-file-details'>
                                                                        <p className='chat-file-name'>{message.metadata.fileName}</p>
                                                                        <p className='chat-file-size'>{formatFileSize(message.metadata.fileSize)}</p>
                                                                    </div>
                                                                    <a 
                                                                        href={message.metadata.fileUrl} 
                                                                        download={message.metadata.fileName}
                                                                        className='chat-file-download'
                                                                    >
                                                                        <IoDownloadOutline />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className='chat-file-info'>
                                                                <div className='chat-file-icon'>
                                                                    <IoDocumentOutline />
                                                                </div>
                                                                <div className='chat-file-details'>
                                                                    <p className='chat-file-name'>{message.metadata.fileName}</p>
                                                                    <p className='chat-file-size'>{formatFileSize(message.metadata.fileSize)}</p>
                                                                </div>
                                                                <a 
                                                                    href={message.metadata.fileUrl} 
                                                                    download={message.metadata.fileName}
                                                                    className='chat-file-download'
                                                                >
                                                                    <IoDownloadOutline />
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className='chat-message-text'>{message.content}</p>
                                                )}
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

                        {/* File Previews */}
                        {filePreviews.length > 0 && (
                            <div className='chat-file-previews-container'>
                                <div className='chat-file-previews-header'>
                                    <span>Archivos seleccionados ({filePreviews.length})</span>
                                    <button 
                                        type='button' 
                                        className='chat-clear-files'
                                        onClick={() => {
                                            setSelectedFiles([]);
                                            setFilePreviews([]);
                                        }}
                                    >
                                        <IoCloseOutline />
                                    </button>
                                </div>
                                <div className='chat-file-previews-grid'>
                                    {filePreviews.map((item, index) => (
                                        <div key={index} className='chat-file-preview-item'>
                                            <img 
                                                src={item.preview} 
                                                alt={item.file.name}
                                                className='chat-file-preview-image'
                                            />
                                            <div className='chat-file-preview-info'>
                                                <span className='chat-file-preview-name'>{item.file.name}</span>
                                                <span className='chat-file-preview-size'>{formatFileSize(item.file.size)}</span>
                                            </div>
                                            <button 
                                                type='button'
                                                className='chat-file-preview-remove'
                                                onClick={() => removeFile(index)}
                                            >
                                                <IoCloseCircleOutline />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Message Input */}
                        <form onSubmit={handleSend} className='chat-input-container'>
                            <div className='chat-input-wrapper'>
                                <input
                                    type='file'
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    multiple
                                    style={{ display: 'none' }}
                                />
                                <button 
                                    type='button' 
                                    className='chat-header-action' 
                                    title='Attach File'
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <IoAttachOutline />
                                </button>
                                <textarea 
                                    className='chat-input'
                                    placeholder='Type a message...'
                                    rows={1}
                                    value={messageInput}
                                    onChange={handleInputChange}
                                />
                                <button 
                                    type='button' 
                                    className='chat-header-action' 
                                    title='Emoji'
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                >
                                    <IoHappyOutline />
                                </button>
                                <button 
                                    type='submit' 
                                    className='chat-send-button' 
                                    title='Send Message' 
                                    disabled={!messageInput.trim() && selectedFiles.length === 0}
                                >
                                    {isUploading ? (
                                        <div className='chat-send-loading' />
                                    ) : (
                                        <IoPaperPlaneOutline />
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Emoji Picker */}
                        {showEmojiPicker && (
                            <div ref={emojiPickerRef} className='chat-emoji-picker'>
                                <div className='chat-emoji-picker-header'>
                                    <span>Seleccionar emoji</span>
                                    <button 
                                        type='button'
                                        className='chat-emoji-picker-close'
                                        onClick={() => setShowEmojiPicker(false)}
                                    >
                                        <IoCloseOutline />
                                    </button>
                                </div>
                                <div className='chat-emoji-picker-grid'>
                                    {emojis.map((emoji, index) => (
                                        <button
                                            key={index}
                                            type='button'
                                            className='chat-emoji-picker-item'
                                            onClick={() => insertEmoji(emoji)}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
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
                        <h3 className='chat-details-title'>
                            {currentChat?.isGroup ? 'Group Info' : 'Contact Info'}
                        </h3>
                    </div>
                    
                    <div className='chat-details-content'>
                        {currentChat?.isGroup ? (
                            <div className='chat-details-section'>
                                <div className='chat-group-info'>
                                    <div className='chat-group-avatar'>
                                        <IoPeopleOutline />
                                    </div>
                                    <h4 className='chat-group-name'>{currentChat.groupName}</h4>
                                    {currentChat.groupDescription && (
                                        <p className='chat-group-description'>{currentChat.groupDescription}</p>
                                    )}
                                    <p className='chat-group-members-count'>
                                        {currentChat.participants.length} members
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className='chat-details-section'>
                                <div className='chat-details-user-info'>
                                    <div className='chat-details-avatar'>
                                        {currentParticipant ? getInitials(currentParticipant.firstName, currentParticipant.lastName) : '?'}
                                    </div>
                                    <h4 className='chat-details-name'>
                                        {currentParticipant ? `${currentParticipant.firstName} ${currentParticipant.lastName}` : 'Unknown'}
                                    </h4>
                                    <div className='chat-details-status'>
                                        {isConnected ? 'Online' : 'Connecting...'}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                {currentChat?.isGroup ? (
                                    <button 
                                        className='chat-details-action'
                                        onClick={() => setShowGroupManagement(true)}
                                    >
                                        <i className='chat-details-action-icon'>
                                            <IoEllipsisVerticalOutline />
                                        </i>
                                        <span className='chat-details-action-text'>Manage Group</span>
                                    </button>
                                ) : (
                                    <button className='chat-details-action'>
                                        <i className='chat-details-action-icon'>
                                            <IoInformationCircleOutline />
                                        </i>
                                        <span className='chat-details-action-text'>View Profile</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {currentChat?.isGroup && (
                            <div className='chat-details-section'>
                                <h4 className='chat-details-section-title'>Group Members</h4>
                                <div className='chat-group-members'>
                                    {currentChat.participants.map((member) => (
                                        <div key={member._id} className='chat-group-member'>
                                            <div className='chat-group-member-avatar'>
                                                {getInitials(member.firstName, member.lastName)}
                                            </div>
                                            <div className='chat-group-member-info'>
                                                <span className='chat-group-member-name'>
                                                    {member.firstName} {member.lastName}
                                                </span>
                                                {currentChat.admins.some(admin => admin._id === member._id) && (
                                                    <span className='chat-admin-badge'>Admin</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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

            {/* Create Group Modal */}
            {showCreateGroup && (
                <div className='chat-group-management-modal'>
                    <div className='chat-group-management-content'>
                        <div className='chat-group-management-header'>
                            <h3>Create New Group</h3>
                            <button 
                                className='chat-close-modal'
                                onClick={() => setShowCreateGroup(false)}
                            >
                                <IoCloseOutline />
                            </button>
                        </div>
                        <div className='chat-group-management-body'>
                            <div className='chat-create-group-container'>
                                <div className='chat-create-group-form'>
                                    <input
                                        type='text'
                                        className='chat-create-group-input'
                                        placeholder='Group name'
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                    />
                                    <textarea
                                        className='chat-create-group-textarea'
                                        placeholder='Group description (optional)'
                                        value={groupDescription}
                                        onChange={(e) => setGroupDescription(e.target.value)}
                                    />
                                </div>
                                <div className='chat-create-group-members'>
                                    <h5>Select Members</h5>
                                    {teamMembers
                                        .filter(member => member._id !== user?._id)
                                        .map((member) => (
                                            <div 
                                                key={member._id}
                                                className={`chat-create-group-member ${selectedMembers.includes(member._id) ? 'selected' : ''}`}
                                                onClick={() => toggleMemberSelection(member._id)}
                                            >
                                                <div className='chat-group-member-avatar'>
                                                    {getInitials(member.firstName, member.lastName)}
                                                </div>
                                                <div className='chat-group-member-info'>
                                                    <span className='chat-group-member-name'>
                                                        {member.firstName} {member.lastName}
                                                    </span>
                                                </div>
                                                {selectedMembers.includes(member._id) && (
                                                    <IoCheckmarkOutline className='chat-member-selected-icon' />
                                                )}
                                            </div>
                                        ))}
                                </div>
                                <div className='chat-create-group-actions'>
                                    <button 
                                        className='chat-create-group-cancel'
                                        onClick={() => setShowCreateGroup(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        className='chat-create-group-create'
                                        onClick={handleCreateGroup}
                                        disabled={!groupName.trim() || selectedMembers.length === 0}
                                    >
                                        Create Group
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Management Modal */}
            {showGroupManagement && currentChat?.isGroup && (
                <div className='chat-group-management-modal'>
                    <div className='chat-group-management-content'>
                        <div className='chat-group-management-header'>
                            <h3>Group Management</h3>
                            <button 
                                className='chat-close-modal'
                                onClick={() => setShowGroupManagement(false)}
                            >
                                <IoCloseOutline />
                            </button>
                        </div>
                        <div className='chat-group-management-body'>
                            <div className='chat-group-management-members'>
                                <h5>Group Members</h5>
                                {currentChat.participants.map((member) => (
                                    <div key={member._id} className='chat-group-management-member'>
                                        <div className='chat-group-member-avatar'>
                                            {getInitials(member.firstName, member.lastName)}
                                        </div>
                                        <div className='chat-group-member-info'>
                                            <span className='chat-group-member-name'>
                                                {member.firstName} {member.lastName}
                                            </span>
                                            {currentChat.admins.some(admin => admin._id === member._id) && (
                                                <span className='chat-admin-badge'>Admin</span>
                                            )}
                                        </div>
                                        {member._id !== user?._id && (
                                            <button 
                                                className='chat-remove-member'
                                                onClick={() => handleRemoveMember(member._id)}
                                            >
                                                <IoTrashOutline />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className='chat-group-management-actions'>
                                <button 
                                    className='chat-group-management-cancel'
                                    onClick={() => setShowGroupManagement(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className='chat-group-management-add'
                                    onClick={openAddMembers}
                                >
                                    <IoAddOutline /> Add Members
                                </button>
                                <button 
                                    className='chat-group-management-add'
                                    onClick={openEditGroup}
                                >
                                    <IoCreateOutline /> Edit Group
                                </button>
                                <button 
                                    className='chat-leave-group'
                                    onClick={handleLeaveGroup}
                                >
                                    <IoPersonRemoveOutline /> Leave Group
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Group Modal */}
            {showEditGroup && currentChat?.isGroup && (
                <div className='chat-edit-group-modal'>
                    <div className='chat-edit-group-content'>
                        <div className='chat-edit-group-header'>
                            <h3>Edit Group</h3>
                            <button 
                                className='chat-close-modal'
                                onClick={() => setShowEditGroup(false)}
                            >
                                <IoCloseOutline />
                            </button>
                        </div>
                        <div className='chat-edit-group-body'>
                            <div className='chat-edit-group-form'>
                                <input
                                    type='text'
                                    className='chat-edit-group-input'
                                    placeholder='Group name'
                                    value={editGroupName}
                                    onChange={(e) => setEditGroupName(e.target.value)}
                                />
                                <textarea
                                    className='chat-edit-group-textarea'
                                    placeholder='Group description'
                                    value={editGroupDescription}
                                    onChange={(e) => setEditGroupDescription(e.target.value)}
                                />
                            </div>
                            <div className='chat-edit-group-actions'>
                                <button 
                                    className='chat-edit-group-cancel'
                                    onClick={() => setShowEditGroup(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className='chat-edit-group-save'
                                    onClick={handleUpdateGroupInfo}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Members Modal */}
            {showAddMembers && currentChat?.isGroup && (
                <div className='chat-group-management-modal'>
                    <div className='chat-group-management-content'>
                        <div className='chat-group-management-header'>
                            <h3>Add Members</h3>
                            <button 
                                className='chat-close-modal'
                                onClick={() => setShowAddMembers(false)}
                            >
                                <IoCloseOutline />
                            </button>
                        </div>
                        <div className='chat-group-management-body'>
                            <div className='chat-create-group-members'>
                                <h5>Select Members to Add</h5>
                                {teamMembers
                                    .filter(member => 
                                        member._id !== user?._id && 
                                        !currentChat.participants.some(p => p._id === member._id)
                                    )
                                    .map((member) => (
                                        <div 
                                            key={member._id}
                                            className={`chat-create-group-member ${selectedMembers.includes(member._id) ? 'selected' : ''}`}
                                            onClick={() => toggleMemberSelection(member._id)}
                                        >
                                            <div className='chat-group-member-avatar'>
                                                {getInitials(member.firstName, member.lastName)}
                                            </div>
                                            <div className='chat-group-member-info'>
                                                <span className='chat-group-member-name'>
                                                    {member.firstName} {member.lastName}
                                                </span>
                                            </div>
                                            {selectedMembers.includes(member._id) && (
                                                <IoCheckmarkOutline className='chat-member-selected-icon' />
                                            )}
                                        </div>
                                    ))}
                            </div>
                            <div className='chat-group-management-actions'>
                                <button 
                                    className='chat-group-management-cancel'
                                    onClick={() => setShowAddMembers(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className='chat-group-management-add'
                                    onClick={handleAddMembers}
                                    disabled={selectedMembers.length === 0}
                                >
                                    Add Members
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardContainer>
    )
};

export default MessagesPage;