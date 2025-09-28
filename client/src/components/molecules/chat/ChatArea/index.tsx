import React, { useEffect, useRef, useState } from 'react';
import {
    IoCallOutline, 
    IoVideocamOutline, 
    IoInformationCircleOutline,
    IoEllipsisVerticalOutline,
    IoPaperPlaneOutline,
    IoAttachOutline,
    IoHappyOutline,
    IoPeopleOutline,
    IoImageOutline,
    IoDocumentOutline,
    IoDownloadOutline,
    IoCloseCircleOutline,
    IoChatbubblesOutline,
    IoCheckmarkOutline,
    IoCloseOutline,
    IoCreateOutline,
    IoTrashOutline
} from 'react-icons/io5';
import { useChat } from '@/hooks/chat/useChat';
import { getInitials } from '@/utilities/guest';
import { chatApi } from '@/services/chat-api';
import FilePreviewSkeleton from '@/components/atoms/messages/FilePreviewSkeleton';
import MessageSkeleton from '@/components/atoms/messages/MessagesSkeleton';
import ContactInfoSkeleton from '@/components/atoms/messages/ContactInfoSkeleton';
import { formatSize } from '@/utilities/scene-utils';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import useAuthStore from '@/stores/authentication';

const ChatArea = () => {
    const [showGroupManagement, setShowGroupManagement] = useState(false);
    const [filePreviews, setFilePreviews] = useState<{file: File, preview: string}[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [editingMessage, setEditingMessage] = useState<string | null>(null);
    const [showReactions, setShowReactions] = useState<string | null>(null);
    const [showMessageOptions, setShowMessageOptions] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [sharedFilePreviews, setSharedFilePreviews] = useState<{[key: string]: string}>({});

    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messageOptionsRef = useRef<HTMLDivElement>(null);

    const user = useAuthStore((store) => store.user);

    const { 
        handleTyping,
        sendFileMessage,
        handleSendMessage,
        messages,
        currentChat, 
        editMessage,
        deleteMessage,
        toggleReaction,
        getUserPresence,
        typingUsers, 
        isLoading, 
        isConnected } = useChat();
    
    // Get the other participant in the current chat
    const currentParticipant = currentChat?.participants.find(p => p._id !== user?._id);
    const [editMessageContent, setEditMessageContent] = useState('');

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

    const handleEditMessage = (messageId: string, content: string) => {
        setEditingMessage(messageId);
        setEditMessageContent(content);
    };

    // Handle typing
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageInput(e.target.value);
        if (currentChat) {
            handleTyping(currentChat._id);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingMessage || !editMessageContent.trim()) return;
        try {
            await editMessage(editingMessage, editMessageContent);
            setEditingMessage(null);
            setEditMessageContent('');
        } catch (error) {
            console.error('Failed to edit message:', error);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            await deleteMessage(messageId);
        } catch (error) {
            console.error('Failed to delete message:', error);
        }
    };

    const handleToggleReaction = async (messageId: string, emoji: string) => {
        try {
            await toggleReaction(messageId, emoji);
        } catch (error) {
            console.error('Failed to toggle reaction:', error);
        }
    };

    const handleShowReactions = (messageId: string) => {
        setShowReactions(showReactions === messageId ? null : messageId);
    };

    const handleShowMessageOptions = (messageId: string) => {
        setShowMessageOptions(showMessageOptions === messageId ? null : messageId);
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

    // Emoji handling functions
    const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

    const insertEmoji = (emoji: string) => {
        setMessageInput(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // Close emoji picker and message options when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            
            // Close emoji picker if clicking outside
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
                setShowEmojiPicker(false);
            }
            
            // Close message options menu if clicking outside
            if (messageOptionsRef.current && !messageOptionsRef.current.contains(target)) {
                setShowMessageOptions(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load file preview for shared files
    const loadFilePreview = async (messageId: string) => {
        if (!currentChat || sharedFilePreviews[messageId]) return;
        
        try {
            const preview = await chatApi.getFilePreview(currentChat._id, messageId);
            setSharedFilePreviews(prev => ({
                ...prev,
                [messageId]: preview.dataUrl
            }));
        } catch (error) {
            console.error('Failed to load file preview:', error);
        }
    };

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
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
                                        : currentParticipant ? (
                                            getUserPresence(currentParticipant._id) === 'online' ? 'Online' : 'Offline'
                                        ) : (
                                            isConnected ? 'Online' : 'Connecting...'
                                        )
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
                            // Show skeleton while loading messages
                            Array.from({ length: 5 }).map((_, index) => (
                                <MessageSkeleton 
                                    key={`message-skeleton-${index}`} 
                                    isSent={index % 3 === 0} 
                                />
                            ))
                        ) : messages.length === 0 ? (
                            <div className='chat-empty-messages'>
                                <p>No messages yet</p>
                                <p>Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((message) => {
                                const isSent = message.sender._id === user?._id;
                                const isDeleted = message.deleted;
                                
                                return (
                                    <div key={message._id} className={`chat-message ${isSent ? 'sent' : 'received'} ${isDeleted ? 'deleted' : ''}`}>
                                        <div className='chat-message-content'>
                                            {message.messageType === 'file' && message.metadata ? (
                                                <div className='chat-file-message'>
                                                    {message.metadata.fileType?.startsWith('image/') ? (
                                                        <div className='chat-image-message'>
                                                            {(() => {
                                                                // Load preview for images in chat messages
                                                                if (message.metadata?.fileType?.startsWith('image/')) {
                                                                    loadFilePreview(message._id);
                                                                }
                                                                
                                                                return sharedFilePreviews[message._id] ? (
                                                                    <img 
                                                                        src={sharedFilePreviews[message._id]} 
                                                                        alt={message.metadata.fileName}
                                                                        className='chat-image-preview'
                                                                    />
                                                                ) : (
                                                                    <div className='chat-image-loading'>
                                                                        <IoImageOutline />
                                                                    </div>
                                                                );
                                                            })()}
                                                            <div className='chat-file-info'>
                                                                <div className='chat-file-icon'>
                                                                    <IoImageOutline />
                                                                </div>
                                                                <div className='chat-file-details'>
                                                                    <p className='chat-file-name'>{message.metadata.fileName}</p>
                                                                    <p className='chat-file-size'>{formatSize(message.metadata.fileSize ?? 0)}</p>
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
                                                                <p className='chat-file-size'>{formatSize(message.metadata.fileSize ?? 0)}</p>
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
                                                isDeleted ? (
                                                    <p className='chat-message-text deleted-message'>
                                                        This message was deleted
                                                    </p>
                                                ) : editingMessage === message._id ? (
                                                    <div className='chat-message-edit'>
                                                        <textarea
                                                            value={editMessageContent}
                                                            onChange={(e) => setEditMessageContent(e.target.value)}
                                                            className='chat-message-edit-input'
                                                            autoFocus
                                                        />
                                                        <div className='chat-message-edit-actions'>
                                                            <button 
                                                                className='chat-message-edit-save'
                                                                onClick={handleSaveEdit}
                                                            >
                                                                <IoCheckmarkOutline />
                                                            </button>
                                                            <button 
                                                                className='chat-message-edit-cancel'
                                                                onClick={() => {
                                                                    setEditingMessage(null);
                                                                    setEditMessageContent('');
                                                                }}
                                                            >
                                                                <IoCloseOutline />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className='chat-message-text'>{message.content}</p>
                                                )
                                            )}
                                            
                                            {/* Message options and reactions buttons - hide for deleted messages */}
                                            {!isDeleted && (
                                                <div className='chat-message-controls'>
                                                {/* Reaction button - available for all users */}
                                                <button 
                                                    className='chat-message-reaction-btn'
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleShowReactions(message._id);
                                                    }}
                                                >
                                                    <IoHappyOutline />
                                                </button>
                                                {/* Options button - only for current user's messages */}
                                                {isSent && (
                                                    <button 
                                                        className='chat-message-options'
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleShowMessageOptions(message._id);
                                                        }}
                                                    >
                                                        <IoEllipsisVerticalOutline />
                                                    </button>
                                                )}
                                            </div>
                                            )}
                                            
                                            {/* Floating options menu - only show for non-deleted messages */}
                                            {!isDeleted && showMessageOptions === message._id && (
                                                <div 
                                                    ref={messageOptionsRef}
                                                    className='chat-message-options-menu'
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {message.sender._id === user?._id && (
                                                        <>
                                                            {/* Only show Edit option for text messages */}
                                                            {message.messageType === 'text' && (
                                                                <button 
                                                                    className='chat-message-option'
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleEditMessage(message._id, message.content);
                                                                        setShowMessageOptions(null);
                                                                    }}
                                                                >
                                                                    <IoCreateOutline />
                                                                    Edit
                                                                </button>
                                                            )}
                                                            <button 
                                                                className='chat-message-option danger'
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleDeleteMessage(message._id);
                                                                    setShowMessageOptions(null);
                                                                }}
                                                            >
                                                                <IoTrashOutline />
                                                                Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {/* Reactions menu - positioned at bottom */}
                                            {showReactions === message._id && (
                                                <div className='chat-message-reactions-menu'>
                                                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            className='chat-reaction-btn'
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                console.log('Reaction button clicked:', emoji, message._id);
                                                                handleToggleReaction(message._id, emoji);
                                                                setShowReactions(null); 
                                                            }}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Always show reactions display */}
                                            <div className='chat-message-reactions-display'>
                                                {message.reactions && message.reactions.length > 0 ? (
                                                    message.reactions
                                                        .filter(reaction => reaction.users && reaction.users.length > 0) // Only show reactions with users
                                                        .map((reaction) => {
                                                            const userReacted = reaction.users?.some(u => {
                                                                const uId = typeof u === 'string' ? u : u._id;
                                                                return uId === user?._id;
                                                            });
                                                            return (
                                                                <span 
                                                                    key={`${reaction.emoji}-${message._id}`} // Use emoji + messageId as unique key
                                                                    className={`chat-reaction ${userReacted ? 'user-reacted' : ''}`}
                                                                    onClick={() => handleToggleReaction(message._id, reaction.emoji)}
                                                                >
                                                                    {reaction.emoji} {reaction.users?.length || 0}
                                                                </span>
                                                            );
                                                        })
                                                ) : null}
                                            </div>
                                            <div className='chat-message-time'>
                                                {formatTimeAgo(message.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        
                        {/* Typing Indicator */}
                        {typingUsers.length > 0 && (
                            <div className='chat-message received'>
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
                                            <span className='chat-file-preview-size'>{formatSize(item.file.size)}</span>
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
                    {!currentChat ? (
                        // No chat selected state
                        <div className='chat-no-selection'>
                            <div className='chat-no-selection-icon'>
                                <IoChatbubblesOutline />
                            </div>
                            <h4 className='chat-no-selection-title'>No chat selected</h4>
                            <p className='chat-no-selection-description'>
                                Select a conversation to view details
                            </p>
                        </div>
                    ) : isLoading ? (
                        // Show skeleton while loading contact info
                        <ContactInfoSkeleton />
                    ) : currentChat?.isGroup ? (
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
                                    {currentParticipant ? (
                                        getUserPresence(currentParticipant._id) === 'online' ? 'Online' : 'Offline'
                                    ) : (
                                        isConnected ? 'Online' : 'Connecting...'
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions - only show when chat is selected and not loading */}
                    {currentChat && !isLoading && (
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
                    )}

                    {currentChat?.isGroup && (
                        <div className='chat-details-section'>
                            <h4 className='chat-details-section-title'>Group Members</h4>
                            <div className='chat-group-members'>
                                {currentChat.participants
                                    .filter((member, index, self) => 
                                        self.findIndex(m => m._id === member._id) === index
                                    )
                                    .map((member) => (
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

                    {/* Shared Files - only show when chat is selected and not loading */}
                    {currentChat && !isLoading && (
                        <div className='chat-details-section'>
                            <h4 className='chat-details-section-title'>Shared Files</h4>
                            {(() => {
                            // Filter messages that are files
                            const fileMessages = messages.filter(msg => 
                                msg.messageType === 'file' && msg.metadata && !msg.deleted
                            );
                            
                            if (fileMessages.length === 0) {
                                return (
                                    <div className='chat-empty-state'>
                                        <div className='chat-empty-description'>
                                            No shared files yet
                                        </div>
                                    </div>
                                );
                            }
                            
                            return (
                                <div className='chat-shared-files'>
                                    {isLoading ? (
                                        // Show skeleton while loading files
                                        Array.from({ length: 2 }).map((_, index) => (
                                            <FilePreviewSkeleton key={`file-skeleton-${index}`} />
                                        ))
                                    ) : fileMessages.map((message) => {
                                        // Load preview for images
                                        if (message.metadata?.fileType?.startsWith('image/')) {
                                            loadFilePreview(message._id);
                                        }
                                        
                                        return (
                                            <div key={message._id} className='chat-shared-file-item'>
                                                {message.metadata?.fileType?.startsWith('image/') ? (
                                                    <div className='chat-shared-file-preview'>
                                                        {sharedFilePreviews[message._id] ? (
                                                            <img 
                                                                src={sharedFilePreviews[message._id]} 
                                                                alt={message.metadata?.fileName}
                                                                className='chat-shared-file-image'
                                                            />
                                                        ) : (
                                                            <div className='chat-shared-file-loading'>
                                                                <IoImageOutline />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className='chat-shared-file-icon'>
                                                        <IoDocumentOutline />
                                                    </div>
                                                )}
                                            <div className='chat-shared-file-info'>
                                                <div className='chat-shared-file-name'>
                                                    {message.metadata?.fileName || message.content}
                                                </div>
                                                <div className='chat-shared-file-meta'>
                                                    <span className='chat-shared-file-size'>
                                                        {formatSize(message.metadata?.fileSize ?? 0)}
                                                    </span>
                                                    <span className='chat-shared-file-date'>
                                                        {formatTimeAgo(message.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            <a 
                                                href={message.metadata?.fileUrl} 
                                                download={message.metadata?.fileName}
                                                className='chat-shared-file-download'
                                                title='Download file'
                                            >
                                                <IoDownloadOutline />
                                            </a>
                                        </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatArea;