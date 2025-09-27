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
import jwt from 'jsonwebtoken';
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

        // Handle disconnect
        socket.on('disconnect', () => {
            if (socket.user) {
                console.log(`[ChatModule] User ${socket.user.firstName} disconnected`);
            }
        });
    }
}

export default ChatModule;