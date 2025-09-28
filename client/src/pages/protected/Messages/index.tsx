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
    IoDocumentOutline,
    IoImageOutline,
    IoDownloadOutline
} from 'react-icons/io5';
import { useChat } from '@/hooks/chat/useChat';
import useAuthStore from '@/stores/authentication';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
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
        sendFileMessage,
        handleTyping,
        editMessage,
        deleteMessage,
        toggleReaction,
    } = useChat();

    const { user } = useAuthStore();
    const [messageInput, setMessageInput] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
    const [showTeamMembers, setShowTeamMembers] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const [editingText, setEditingText] = useState('');
	const [uploadingFile, setUploadingFile] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const REACTIONS = ['👍','❤️','😂','😮','😢','🎉'];

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

	// Focus input when switching chats
	useEffect(() => {
		if (currentChat) {
			requestAnimationFrame(() => {
				if (inputRef.current) {
					inputRef.current.focus();
					inputRef.current.style.height = 'auto';
				}
			});
		}
	}, [currentChat]);

    // Handle sending a message
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim()) return;

        await handleSendMessage(messageInput);
        setMessageInput('');
		if (inputRef.current) {
			inputRef.current.style.height = 'auto';
		}
    };

    // Handle typing
	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setMessageInput(e.target.value);
		if (inputRef.current) {
			inputRef.current.style.height = 'auto';
			const nextHeight = Math.min(inputRef.current.scrollHeight, 120);
			inputRef.current.style.height = `${nextHeight}px`;
		}
        if (currentChat) {
            handleTyping(currentChat._id);
        }
    };

    // Format time for display
    const formatTime = (dateString: string) => {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    };

	// Date label for separators
	const getDateLabel = (date: Date) => {
		if (isToday(date)) return 'Today';
		if (isYesterday(date)) return 'Yesterday';
		return format(date, 'PP');
	};

    // Get initials for avatar
    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

	const startEditing = (messageId: string, current: string) => {
		setEditingMessageId(messageId);
		setEditingText(current);
	};

	const saveEditing = async () => {
		if (!editingMessageId) return;
		const trimmed = editingText.trim();
		if (!trimmed) return;
		await editMessage(editingMessageId, trimmed);
		setEditingMessageId(null);
		setEditingText('');
	};

	const cancelEditing = () => {
		setEditingMessageId(null);
		setEditingText('');
	};

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setUploadingFile(true);
		try {
			await sendFileMessage(file);
		} catch (error) {
			console.error('Failed to upload file:', error);
		} finally {
			setUploadingFile(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	const getFileIcon = (mimetype: string) => {
		if (mimetype.startsWith('image/')) return <IoImageOutline />;
		if (mimetype.startsWith('video/')) return <IoVideocamOutline />;
		if (mimetype.startsWith('audio/')) return <IoCallOutline />;
		return <IoDocumentOutline />;
	};

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
							<div className='chat-loading' aria-busy='true' aria-live='polite'>
								<div className='chat-loading-spinner' />
								Loading chats...
							</div>
						) : filteredChats.length === 0 ? (
                        <div className='chat-empty-state'>
                            <p>No conversations yet</p>
                            <p>Start a chat with a team member!</p>
                        </div>
                    ) : (
                        filteredChats.map((chat) => {
                            const participant = chat.participants.find(p => p._id !== user?._id);
                            if (!participant) return null;

								const typingInChat = typingUsers.filter(u => u.chatId === chat._id && u.userId !== user?._id);

                            return (
                                <div 
                                    key={chat._id} 
										className={`chat-conversation-item ${currentChat?._id === chat._id ? 'active' : ''}`}
                                    onClick={() => selectChat(chat)}
										aria-current={currentChat?._id === chat._id ? 'true' : 'false'}
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
											{typingInChat.length > 0 ? (
												<p className='chat-conversation-preview typing' aria-live='polite'>
													Typing...
												</p>
											) : chat.lastMessage ? (
												<p className='chat-conversation-preview'>
													{chat.lastMessage.content}
												</p>
											) : null}
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
							<div className='chat-loading' aria-busy='true' aria-live='polite'>
								<div className='chat-loading-spinner' />
								Loading messages...
							</div>
						) : messages.length === 0 ? (
                                <div className='chat-empty-messages'>
                                    <p>No messages yet</p>
                                    <p>Start the conversation!</p>
                                </div>
                            ) : (
							(() => {
								let lastLabel = '';
								return messages.map((message) => {
                                    const isSent = message.sender._id === user?._id;
									const date = new Date(message.createdAt);
									const label = getDateLabel(date);
									const showSeparator = label !== lastLabel;
									lastLabel = label;
                                    return (
										<React.Fragment key={message._id}>
											{showSeparator && (
												<div className='chat-date-separator' role='separator' aria-label={label}>
													<span>{label}</span>
												</div>
											)}
											<div className={`chat-message ${isSent ? 'sent' : 'received'}`} role='listitem'>
												<div className='chat-message-avatar'>
													{isSent ? 'You' : getInitials(message.sender.firstName, message.sender.lastName)}
												</div>
												<div className='chat-message-content'>
													{message.deleted ? (
														<p className='chat-message-text deleted'>Message deleted</p>
													) : editingMessageId === message._id ? (
														<form onSubmit={(e) => { e.preventDefault(); void saveEditing(); }} className='chat-edit-form'>
															<input
																className='chat-edit-input'
																value={editingText}
																onChange={(e) => setEditingText(e.target.value)}
															/>
															<div className='chat-edit-actions'>
																<button type='button' className='chat-edit-cancel' onClick={cancelEditing}>Cancel</button>
																<button type='submit' className='chat-edit-save'>Save</button>
															</div>
														</form>
													) : message.messageType === 'file' ? (
														<div className='chat-file-message'>
															<div className='chat-file-info'>
																<div className='chat-file-icon'>
																	{getFileIcon(message.metadata?.fileType || '')}
																</div>
																<div className='chat-file-details'>
																	<p className='chat-file-name'>{message.metadata?.fileName}</p>
																	<p className='chat-file-size'>{formatFileSize(message.metadata?.fileSize || 0)}</p>
																</div>
																<a 
																	href={message.metadata?.fileUrl} 
																	target='_blank' 
																	rel='noopener noreferrer'
																	className='chat-file-download'
																	title='Download file'
																>
																	<IoDownloadOutline />
																</a>
															</div>
															{message.metadata?.fileType?.startsWith('image/') && (
																<img 
																	src={message.metadata?.fileUrl} 
																	alt={message.metadata?.fileName}
																	className='chat-file-preview'
																/>
															)}
															<div className='chat-message-time'>
																{formatTime(message.createdAt)}
															</div>
														</div>
													) : (
														<>
															<p className='chat-message-text'>
																{message.content}
																{message.editedAt ? <span className='chat-message-edited'>(edited)</span> : null}
															</p>
															<div className='chat-message-time'>
																{formatTime(message.createdAt)}
															</div>
															<div className='chat-message-reactions'>
																{(message.reactions || []).map(r => (
																	<button key={r.emoji} className='chat-reaction-chip' onClick={() => toggleReaction(message._id, r.emoji)} title={`${r.users.length} reactions`}>
																		<span>{r.emoji}</span>
																		<span className='chat-reaction-count'>{r.users.length}</span>
																	</button>
																))}
																<div className='chat-reaction-palette'>
																	{REACTIONS.map(emoji => (
																		<button key={emoji} className='chat-reaction-btn' onClick={() => toggleReaction(message._id, emoji)} title={`React with ${emoji}`}>{emoji}</button>
																	))}
																</div>
															</div>
															{isSent && (
																<div className='chat-message-menu'>
																	<button className='chat-message-menu-btn' onClick={() => startEditing(message._id, message.content)}>Edit</button>
																	<button className='chat-message-menu-btn danger' onClick={() => void deleteMessage(message._id)}>Delete</button>
																</div>
															)}
														</>
													)}
												</div>
											</div>
										</React.Fragment>
                                    );
								});
							})()
                            )}
                            
                            {/* Typing Indicator */}
						{typingUsers.length > 0 && (
                                <div className='chat-message received'>
                                    <div className='chat-message-avatar'>?</div>
								<div className='chat-typing-indicator' aria-live='polite'>
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
								<input
									type='file'
									ref={fileInputRef}
									onChange={handleFileUpload}
									className='chat-file-input'
									accept='image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar'
									disabled={uploadingFile}
								/>
								<button 
									type='button' 
									className='chat-header-action' 
									title='Attach File' 
									aria-label='Attach file'
									onClick={() => fileInputRef.current?.click()}
									disabled={uploadingFile}
								>
                                    <IoAttachOutline />
                                </button>
								<textarea 
                                    className='chat-input'
									placeholder='Type a message...'
                                    rows={1}
                                    value={messageInput}
                                    onChange={handleInputChange}
									ref={inputRef}
									aria-label='Message input'
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											if (messageInput.trim()) {
												void handleSend(e as unknown as React.FormEvent);
											}
										}
									}}
                                />
								<button type='button' className='chat-header-action' title='Emoji' aria-label='Open emoji picker'>
                                    <IoHappyOutline />
                                </button>
								<button type='submit' className='chat-send-button' title='Send Message' aria-label='Send message' disabled={!messageInput.trim() || uploadingFile}>
                                    {uploadingFile ? '...' : <IoPaperPlaneOutline />}
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
						{currentParticipant ? (
							<>
								<div className='chat-details-section'>
									<div className='chat-details-user-info'>
										<div className='chat-details-avatar'>
											{getInitials(currentParticipant.firstName, currentParticipant.lastName)}
										</div>
										<h4 className='chat-details-name'>
											{currentParticipant.firstName} {currentParticipant.lastName}
										</h4>
										<div className='chat-details-status'>
											{isConnected ? 'Online' : 'Offline'}
										</div>
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
							</>
						) : (
							<div className='chat-empty-state'>
								<p>Select a conversation to view details</p>
							</div>
						)}
					</div>
				</div>
            </div>
        </DashboardContainer>
    )
};

export default MessagesPage;