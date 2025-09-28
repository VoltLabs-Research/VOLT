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

import { Server, Socket } from 'socket.io';
import { User, Chat, Message } from '@/models/index';
import BaseSocketModule from '@/socket/base-socket-module';

interface AuthenticatedSocket extends Socket {
    user?: any;
}

class ChatModule extends BaseSocketModule {
    constructor() {
        super('ChatModule');
    }

    onInit(io: Server): void {
        this.io = io;
    }

    onConnection(socket: AuthenticatedSocket): void {
        // Extract user from socket auth (set by socket.io middleware)
        const user = (socket as any).user;
        if (!user) {
            socket.emit('error', 'Not authenticated');
            return;
        }

        socket.user = user;
        
        // Handle user presence
        this.handleUserPresence(socket, 'online');
        
        // Join user to their personal room for notifications
        this.joinRoom(socket, `user-${user._id}`);
        
        console.log(`[ChatModule] User ${user.firstName} ${user.lastName} connected`);

        // Join a chat room
        socket.on('join_chat', async (chatId: string) => {
            if (!socket.user) {
                socket.emit('error', 'Not authenticated');
                return;
            }

            try {
                // Verify user has access to this chat
                const chat = await Chat.findOne({
                    _id: chatId,
                    participants: socket.user._id,
                    isActive: true
                });

                if (!chat) {
                    socket.emit('error', 'Chat not found or access denied');
                    return;
                }

                this.joinRoom(socket, `chat-${chatId}`);
                socket.emit('joined_chat', { chatId });
                
                console.log(`[ChatModule] User ${socket.user.firstName} joined chat ${chatId}`);
            } catch (error) {
                socket.emit('error', 'Failed to join chat');
            }
        });

        // Leave a chat room
        socket.on('leave_chat', (chatId: string) => {
            this.leaveRoom(socket, `chat-${chatId}`);
            socket.emit('left_chat', { chatId });
        });

        // Send a message
        socket.on('send_message', async (data: { chatId: string; content: string; messageType?: string; metadata?: any }) => {
            if (!socket.user) {
                socket.emit('error', 'Not authenticated');
                return;
            }

            try {
                const { chatId, content, messageType = 'text', metadata } = data;

                // Verify user has access to this chat
                const chat = await Chat.findOne({
                    _id: chatId,
                    participants: socket.user._id,
                    isActive: true
                });

                if (!chat) {
                    socket.emit('error', 'Chat not found or access denied');
                    return;
                }

                // Create the message
                const message = await Message.create({
                    chat: chatId,
                    sender: socket.user._id,
                    content,
                    messageType,
                    metadata,
                    readBy: [socket.user._id] // Sender has read their own message
                });

                await message.populate('sender', 'firstName lastName email');

                // Update chat's last message
                await Chat.findByIdAndUpdate(chatId, {
                    lastMessage: message._id,
                    lastMessageAt: new Date()
                });

                // Broadcast message to all users in the chat room
                this.io?.to(`chat-${chatId}`).emit('new_message', {
                    message,
                    chatId
                });

                console.log(`[ChatModule] Message sent in chat ${chatId} by ${socket.user.firstName}`);
            } catch (error) {
                socket.emit('error', 'Failed to send message');
            }
        });

        // Send a file message
        socket.on('send_file_message', async (data: { chatId: string; filename: string; originalName: string; size: number; mimetype: string; url: string }) => {
            if (!socket.user) {
                socket.emit('error', 'Not authenticated');
                return;
            }

            try {
                const { chatId, filename, originalName, size, mimetype, url } = data;

                // Verify user has access to this chat
                const chat = await Chat.findOne({
                    _id: chatId,
                    participants: socket.user._id,
                    isActive: true
                });

                if (!chat) {
                    socket.emit('error', 'Chat not found or access denied');
                    return;
                }

                // Create the file message
                const message = await Message.create({
                    chat: chatId,
                    sender: socket.user._id,
                    content: originalName, // Use original filename as content
                    messageType: 'file',
                    metadata: {
                        fileName: originalName,
                        fileSize: size,
                        fileType: mimetype,
                        fileUrl: url,
                        filePath: filename
                    },
                    readBy: [socket.user._id] // Sender has read their own message
                });

                await message.populate('sender', 'firstName lastName email');

                // Update chat's last message
                await Chat.findByIdAndUpdate(chatId, {
                    lastMessage: message._id,
                    lastMessageAt: new Date()
                });

                // Broadcast message to all users in the chat room
                this.io?.to(`chat-${chatId}`).emit('new_message', {
                    message,
                    chatId
                });

                console.log(`[ChatModule] File message sent in chat ${chatId} by ${socket.user.firstName}`);
            } catch (error) {
                socket.emit('error', 'Failed to send file message');
            }
        });

        // Edit a message (only sender)
        socket.on('edit_message', async (data: { chatId: string; messageId: string; content: string }) => {
            if (!socket.user) return;
            try {
                const { chatId, messageId, content } = data;
                const message = await Message.findOne({ _id: messageId, chat: chatId });
                if (!message) return;
                if (message.sender.toString() !== socket.user._id.toString()) return;
                message.content = content;
                (message as any).editedAt = new Date();
                await message.save();
                await message.populate('sender', 'firstName lastName email');
                this.io?.to(`chat-${chatId}`).emit('message_edited', { chatId, message });
            } catch {}
        });

        // Delete a message (soft delete)
        socket.on('delete_message', async (data: { chatId: string; messageId: string }) => {
            if (!socket.user) return;
            try {
                const { chatId, messageId } = data;
                const message = await Message.findOne({ _id: messageId, chat: chatId });
                if (!message) return;
                if (message.sender.toString() !== socket.user._id.toString()) return;
                (message as any).deleted = true;
                (message as any).deletedAt = new Date();
                (message as any).deletedBy = socket.user._id;
                await message.save();
                this.io?.to(`chat-${chatId}`).emit('message_deleted', { chatId, messageId });
            } catch {}
        });

        // Toggle reaction
        socket.on('toggle_reaction', async (data: { chatId: string; messageId: string; emoji: string }) => {
            if (!socket.user) return;
            try {
                const { chatId, messageId, emoji } = data;
                const message: any = await Message.findOne({ _id: messageId, chat: chatId });
                if (!message) return;
                
                const reactions = message.reactions || [];
                const userIdStr = socket.user._id.toString();

                // Remove user from all existing reactions first (user can only have one reaction)
                const filteredReactions = reactions.map((reaction: any) => ({
                    ...reaction,
                    users: reaction.users.filter((u: any) => u.toString() !== userIdStr)
                })).filter((reaction: any) => reaction.users.length > 0);

                // Check if user is trying to remove their current reaction
                const currentUserReaction = reactions.find((reaction: any) => 
                    reaction.users.some((u: any) => u.toString() === userIdStr)
                );

                if (currentUserReaction && currentUserReaction.emoji === emoji) {
                    // User is removing their current reaction
                    message.reactions = filteredReactions;
                } else {
                    // User is adding a new reaction (or changing their reaction)
                    const existingEmojiIndex = filteredReactions.findIndex((r: any) => r.emoji === emoji);
                    
                    if (existingEmojiIndex !== -1) {
                        // Add user to existing emoji reaction (only if not already there)
                        const existingUsers = filteredReactions[existingEmojiIndex].users;
                        const userAlreadyExists = existingUsers.some((u: any) => u.toString() === socket.user._id.toString());
                        
                        if (!userAlreadyExists) {
                            filteredReactions[existingEmojiIndex].users.push(socket.user._id);
                        }
                    } else {
                        // Create new emoji reaction
                        filteredReactions.push({ emoji, users: [socket.user._id] });
                    }
                    
                    message.reactions = filteredReactions;
                }

                // Mark the reactions field as modified
                message.markModified('reactions');
                await message.save();
                await message.populate('sender', 'firstName lastName email');
                
                // Emit to all users in the chat to keep everyone in sync
                this.io?.to(`chat-${chatId}`).emit('reaction_updated', { chatId, message });
            } catch (error) {
                console.error('Socket toggle_reaction error:', error);
            }
        });

        // Mark messages as read
        socket.on('mark_read', async (data: { chatId: string }) => {
            if (!socket.user) {
                socket.emit('error', 'Not authenticated');
                return;
            }

            try {
                const { chatId } = data;

                // Verify user has access to this chat
                const chat = await Chat.findOne({
                    _id: chatId,
                    participants: socket.user._id,
                    isActive: true
                });

                if (!chat) {
                    socket.emit('error', 'Chat not found or access denied');
                    return;
                }

                // Mark all unread messages in this chat as read by this user
                await Message.updateMany(
                    {
                        chat: chatId,
                        sender: { $ne: socket.user._id }, // Don't mark own messages
                        readBy: { $ne: socket.user._id }
                    },
                    {
                        $addToSet: { readBy: socket.user._id }
                    }
                );

                // Notify other participants that messages were read
                this.io?.to(`chat-${chatId}`).emit('messages_read', {
                    chatId,
                    readBy: socket.user._id,
                    readAt: new Date()
                });

                console.log(`[ChatModule] Messages marked as read in chat ${chatId} by ${socket.user.firstName}`);
            } catch (error) {
                socket.emit('error', 'Failed to mark messages as read');
            }
        });

        // Typing indicator
        socket.on('typing_start', (data: { chatId: string }) => {
            if (!socket.user) return;
            
            socket.to(`chat-${data.chatId}`).emit('user_typing', {
                chatId: data.chatId,
                userId: socket.user._id,
                userName: `${socket.user.firstName} ${socket.user.lastName}`,
                isTyping: true
            });
        });

        socket.on('typing_stop', (data: { chatId: string }) => {
            if (!socket.user) return;
            
            socket.to(`chat-${data.chatId}`).emit('user_typing', {
                chatId: data.chatId,
                userId: socket.user._id,
                userName: `${socket.user.firstName} ${socket.user.lastName}`,
                isTyping: false
            });
        });

        // Group management events
        socket.on('group_created', (data: { chatId: string }) => {
            if (!socket.user) return;
            // Notify all participants about the new group
            this.io?.to(`chat-${data.chatId}`).emit('group_created', { chatId: data.chatId });
        });

        socket.on('users_added_to_group', (data: { chatId: string; userIds: string[] }) => {
            if (!socket.user) return;
            // Notify all participants about new members
            this.io?.to(`chat-${data.chatId}`).emit('users_added_to_group', { 
                chatId: data.chatId, 
                userIds: data.userIds,
                addedBy: socket.user._id
            });
        });

        socket.on('users_removed_from_group', (data: { chatId: string; userIds: string[] }) => {
            if (!socket.user) return;
            // Notify all participants about removed members
            this.io?.to(`chat-${data.chatId}`).emit('users_removed_from_group', { 
                chatId: data.chatId, 
                userIds: data.userIds,
                removedBy: socket.user._id
            });
        });

        socket.on('group_info_updated', (data: { chatId: string; groupName?: string; groupDescription?: string }) => {
            if (!socket.user) return;
            // Notify all participants about group info changes
            this.io?.to(`chat-${data.chatId}`).emit('group_info_updated', { 
                chatId: data.chatId, 
                groupName: data.groupName,
                groupDescription: data.groupDescription,
                updatedBy: socket.user._id
            });
        });

        socket.on('user_left_group', (data: { chatId: string; userId: string }) => {
            if (!socket.user) return;
            // Notify all participants about user leaving
            this.io?.to(`chat-${data.chatId}`).emit('user_left_group', { 
                chatId: data.chatId, 
                userId: data.userId
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            if (socket.user) {
                this.handleUserPresence(socket, 'offline');
                console.log(`[ChatModule] User ${socket.user.firstName} disconnected`);
            }
        });
    }

    private async handleUserPresence(socket: AuthenticatedSocket, status: 'online' | 'offline'): Promise<void> {
        if (!socket.user) return;

        const userId = socket.user._id.toString();
        
        try {
            // Find all chats where this user participates
            const userChats = await Chat.find({
                participants: userId,
                isActive: true
            });

            // Emit presence update to all users in those chats
            for (const chat of userChats) {
                this.io?.to(`chat-${chat._id}`).emit('user_presence_update', {
                    userId,
                    status,
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`[ChatModule] User ${socket.user.firstName} is now ${status} - notified ${userChats.length} chats`);
        } catch (error) {
            console.error('Error handling user presence:', error);
        }
    }
}

export default ChatModule;