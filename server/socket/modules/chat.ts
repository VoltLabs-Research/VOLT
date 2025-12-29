import { Server, Socket } from 'socket.io';
import { User, Chat, Message } from '@/models/index';
import BaseSocketModule from '@/socket/base-socket-module';
import { redis } from '@/config/redis';
import logger from '@/logger';

interface AuthenticatedSocket extends Socket {
    user?: any;
    rateLimits?: Map<string, number[]>;
}

class ChatModule extends BaseSocketModule {
    private readonly CACHE_TTL = {
        CHAT_PERMISSION: 300,      // 5 minutos
        USER_INFO: 600,            // 10 minutos
        RATE_LIMIT: 60             // 1 minuto
    };

    constructor() {
        super('ChatModule');
    }

    onInit(io: Server): void {
        this.io = io;
    }

    /**
     * ✅ Verificar permisos con Redis cache
     */
    private async verifyUserChatAccess(userId: string, chatId: string): Promise<boolean> {
        if (!redis) {
            // Fallback sin caché si Redis no disponible
            return await this.verifyUserChatAccessDB(userId, chatId);
        }

        const cacheKey = `chat:permission:${userId}:${chatId}`;

        try {
            // ✅ Check Redis cache first
            const cached = await redis.get(cacheKey);
            if (cached !== null) {
                return cached === '1';
            }

            // ✅ Query DB
            const hasAccess = await this.verifyUserChatAccessDB(userId, chatId);

            // ✅ Cache result in Redis
            await redis.setex(
                cacheKey,
                this.CACHE_TTL.CHAT_PERMISSION,
                hasAccess ? '1' : '0'
            );

            return hasAccess;
        } catch (error) {
            logger.error(`Redis cache error: ${error}`);
            // Fallback a query directo si Redis falla
            return await this.verifyUserChatAccessDB(userId, chatId);
        }
    }

    /**
     * Query DB para verificar acceso
     */
    private async verifyUserChatAccessDB(userId: string, chatId: string): Promise<boolean> {
        const hasAccess = await Chat.exists({
            _id: chatId,
            participants: userId,
            $or: [
                { isGroup: false },
                { isGroup: true, isActive: true }
            ]
        });
        return !!hasAccess;
    }

    /**
     * ✅ Rate limiting con Redis(más robusto)
     */
    private async checkRateLimit(
        userId: string,
        event: string,
        maxPerMinute: number = 30
    ): Promise<boolean> {
        if (!redis) {
            return true; // Permitir si Redis no disponible(o implementar fallback local)
        }

        const key = `rate:${event}:${userId}`;
        const now = Date.now();

        try {
            // ✅ Usar Redis Sorted Set para rate limiting preciso
            // Remover entradas antiguas(> 1 minuto)
            await redis.zremrangebyscore(key, 0, now - 60000);

            // Contar requests recientes
            const count = await redis.zcard(key);

            if (count >= maxPerMinute) {
                return false; // Rate limit exceeded
            }

            // Agregar timestamp actual
            await redis.zadd(key, now, `${now}`);

            // Set expiration
            await redis.expire(key, 60);

            return true;
        } catch (error) {
            logger.error(`Redis rate limit error: ${error}`);
            return true; // Permitir en caso de error(fail open)
        }
    }

    /**
     * ✅ Obtener info de usuario con Redis cache
     */
    private async getUserInfo(userId: string) {
        if (!redis) {
            return await this.getUserInfoDB(userId);
        }

        const cacheKey = `user:info:${userId}`;

        try {
            // Check cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            // Query DB
            const user = await this.getUserInfoDB(userId);
            if (user) {
                await redis.setex(
                    cacheKey,
                    this.CACHE_TTL.USER_INFO,
                    JSON.stringify(user)
                );
            }

            return user;
        } catch (error) {
            logger.error(`Redis user cache error: ${error}`);
            return await this.getUserInfoDB(userId);
        }
    }

    /**
     * Query DB para info de usuario
     */
    private async getUserInfoDB(userId: string) {
        return await User.findById(userId)
            .select('firstName lastName email avatar')
            .lean();
    }

    /**
     * ✅ Invalidar caché de chat(multi-server safe)
     */
    private async invalidateChatCache(chatId: string, userIds?: string[]): Promise<void> {
        if (!redis) return;

        try {
            if (userIds) {
                // Invalidar solo para usuarios específicos
                const keys = userIds.map(userId => `chat:permission:${userId}:${chatId}`);
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } else {
                // Invalidar todos los permisos de este chat
                const pattern = `chat:permission:*:${chatId}`;
                const keys = await redis.keys(pattern);
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            }
        } catch (error) {
            logger.error(`Error invalidating chat cache: ${error}`);
        }
    }

    /**
     * ✅ Invalidar caché de usuario
     */
    private async invalidateUserCache(userId: string): Promise<void> {
        if (!redis) return;

        try {
            await redis.del(`user:info:${userId}`);
        } catch (error) {
            logger.error(`Error invalidating user cache: ${error}`);
        }
    }

    onConnection(socket: AuthenticatedSocket): void {
        const user = (socket as any).user;
        if (!user) {
            socket.emit('error', 'Not authenticated');
            return;
        }

        socket.user = user;
        this.handleUserPresence(socket, 'online');
        this.joinRoom(socket, `user-${user._id}`);

        logger.info(`[ChatModule] User ${user.firstName} ${user.lastName} connected`);

        // ✅ Join chat con Redis cache
        socket.on('join_chat', async (chatId: string) => {
            if (!socket.user) return;

            const hasAccess = await this.verifyUserChatAccess(
                socket.user._id.toString(),
                chatId
            );

            if (!hasAccess) {
                socket.emit('error', 'Chat not found or access denied');
                return;
            }

            this.joinRoom(socket, `chat-${chatId}`);
            socket.emit('joined_chat', { chatId });
        });

        // ✅ Send message con Redis rate limiting
        socket.on('send_message', async (data: {
            chatId: string;
            content: string;
            messageType?: string;
            metadata?: any
        }) => {
            if (!socket.user) return;

            // ✅ Redis rate limiting
            const allowed = await this.checkRateLimit(
                socket.user._id.toString(),
                'send_message',
                30
            );

            if (!allowed) {
                socket.emit('error', 'Rate limit exceeded. Max 30 messages per minute.');
                return;
            }

            try {
                const { chatId, content, messageType = 'text', metadata } = data;

                // ✅ Verificar acceso con Redis cache
                const hasAccess = await this.verifyUserChatAccess(
                    socket.user._id.toString(),
                    chatId
                );

                if (!hasAccess) {
                    socket.emit('error', 'Chat not found or access denied');
                    return;
                }

                // Crear mensaje
                const message = await Message.create({
                    chat: chatId,
                    sender: socket.user._id,
                    content,
                    messageType,
                    metadata,
                    readBy: [socket.user._id]
                });

                // Update chat(fire and forget)
                Chat.findByIdAndUpdate(chatId, {
                    lastMessage: message._id,
                    lastMessageAt: new Date()
                }).exec();

                // Agregar sender info desde socket.user(sin populate)
                const messageWithSender = {
                    ...message.toObject(),
                    sender: {
                        _id: socket.user._id,
                        firstName: socket.user.firstName,
                        lastName: socket.user.lastName,
                        email: socket.user.email,
                        avatar: socket.user.avatar
                    }
                };

                // Emitir inmediatamente
                this.io?.to(`chat-${chatId}`).emit('new_message', {
                    message: messageWithSender,
                    chatId
                });

                logger.info(`[ChatModule] Message sent in chat ${chatId}`);
            } catch (error) {
                logger.error(`Error sending message: ${error}`);
                socket.emit('error', 'Failed to send message');
            }
        });

        // ✅ Send file message
        socket.on('send_file_message', async (data: {
            chatId: string;
            filename: string;
            originalName: string;
            size: number;
            mimetype: string;
            url: string
        }) => {
            if (!socket.user) return;

            const allowed = await this.checkRateLimit(
                socket.user._id.toString(),
                'send_file_message',
                10
            );

            if (!allowed) {
                socket.emit('error', 'Rate limit exceeded. Max 10 files per minute.');
                return;
            }

            try {
                const { chatId, filename, originalName, size, mimetype, url } = data;

                const hasAccess = await this.verifyUserChatAccess(
                    socket.user._id.toString(),
                    chatId
                );

                if (!hasAccess) {
                    socket.emit('error', 'Chat not found or access denied');
                    return;
                }

                const message = await Message.create({
                    chat: chatId,
                    sender: socket.user._id,
                    content: originalName,
                    messageType: 'file',
                    metadata: {
                        fileName: originalName,
                        fileSize: size,
                        fileType: mimetype,
                        fileUrl: url,
                        filePath: filename
                    },
                    readBy: [socket.user._id]
                });

                Chat.findByIdAndUpdate(chatId, {
                    lastMessage: message._id,
                    lastMessageAt: new Date()
                }).exec();

                const messageWithSender = {
                    ...message.toObject(),
                    sender: {
                        _id: socket.user._id,
                        firstName: socket.user.firstName,
                        lastName: socket.user.lastName,
                        email: socket.user.email,
                        avatar: socket.user.avatar
                    }
                };

                this.io?.to(`chat-${chatId}`).emit('new_message', {
                    message: messageWithSender,
                    chatId
                });
            } catch (error) {
                socket.emit('error', 'Failed to send file message');
            }
        });

        // ✅ Edit message
        socket.on('edit_message', async (data: {
            chatId: string;
            messageId: string;
            content: string
        }) => {
            if (!socket.user) return;

            const allowed = await this.checkRateLimit(
                socket.user._id.toString(),
                'edit_message',
                20
            );

            if (!allowed) {
                socket.emit('error', 'Rate limit exceeded');
                return;
            }

            try {
                const { chatId, messageId, content } = data;

                const message = await Message.findOne({
                    _id: messageId,
                    chat: chatId,
                    sender: socket.user._id
                });

                if (!message) {
                    socket.emit('error', 'Message not found or access denied');
                    return;
                }

                message.content = content;
                (message as any).editedAt = new Date();
                await message.save();

                const messageWithSender = {
                    ...message.toObject(),
                    sender: {
                        _id: socket.user._id,
                        firstName: socket.user.firstName,
                        lastName: socket.user.lastName,
                        email: socket.user.email,
                        avatar: socket.user.avatar
                    }
                };

                this.io?.to(`chat-${chatId}`).emit('message_edited', {
                    chatId,
                    message: messageWithSender
                });
            } catch (error) {
                socket.emit('error', 'Failed to edit message');
            }
        });

        // ✅ Delete message
        socket.on('delete_message', async (data: { chatId: string; messageId: string }) => {
            if (!socket.user) return;

            try {
                const { chatId, messageId } = data;

                const result = await Message.updateOne(
                    {
                        _id: messageId,
                        chat: chatId,
                        sender: socket.user._id
                    },
                    {
                        $set: {
                            deleted: true,
                            deletedAt: new Date(),
                            deletedBy: socket.user._id
                        }
                    }
                );

                if (result.modifiedCount > 0) {
                    this.io?.to(`chat-${chatId}`).emit('message_deleted', { chatId, messageId });
                }
            } catch (error) {
                socket.emit('error', 'Failed to delete message');
            }
        });

        // ✅ Toggle reaction
        socket.on('toggle_reaction', async (data: {
            chatId: string;
            messageId: string;
            emoji: string
        }) => {
            if (!socket.user) return;

            const allowed = await this.checkRateLimit(
                socket.user._id.toString(),
                'toggle_reaction',
                60
            );

            if (!allowed) return;

            try {
                const { chatId, messageId, emoji } = data;
                const message: any = await Message.findOne({ _id: messageId, chat: chatId });
                if (!message) return;

                const reactions = message.reactions || [];
                const userIdStr = socket.user._id.toString();

                const filteredReactions = reactions.map((reaction: any) => ({
                    ...reaction,
                    users: reaction.users.filter((u: any) => u.toString() !== userIdStr)
                })).filter((reaction: any) => reaction.users.length > 0);

                const currentUserReaction = reactions.find((reaction: any) =>
                    reaction.users.some((u: any) => u.toString() === userIdStr)
                );

                if (currentUserReaction && currentUserReaction.emoji === emoji) {
                    message.reactions = filteredReactions;
                } else {
                    const existingEmojiIndex = filteredReactions.findIndex((r: any) => r.emoji === emoji);

                    if (existingEmojiIndex !== -1) {
                        filteredReactions[existingEmojiIndex].users.push(socket.user._id);
                    } else {
                        filteredReactions.push({ emoji, users: [socket.user._id] });
                    }

                    message.reactions = filteredReactions;
                }

                message.markModified('reactions');
                await message.save();

                // Populate the message to ensure proper serialization
                const populatedMessage = await Message.findById(messageId)
                    .populate('sender', 'firstName lastName email avatar')
                    .lean();

                this.io?.to(`chat-${chatId}`).emit('reaction_updated', {
                    chatId,
                    message: populatedMessage
                });
            } catch (error) {
                logger.error(`Socket toggle_reaction error: ${error}`);
            }
        });

        // ✅ Mark read
        socket.on('mark_read', async (data: { chatId: string }) => {
            if (!socket.user) return;

            try {
                const { chatId } = data;

                const hasAccess = await this.verifyUserChatAccess(
                    socket.user._id.toString(),
                    chatId
                );

                if (!hasAccess) return;

                const result = await Message.updateMany(
                    {
                        chat: chatId,
                        sender: { $ne: socket.user._id },
                        readBy: { $ne: socket.user._id }
                    },
                    {
                        $addToSet: { readBy: socket.user._id }
                    }
                );

                if (result.modifiedCount > 0) {
                    this.io?.to(`chat-${chatId}`).emit('messages_read', {
                        chatId,
                        readBy: socket.user._id,
                        readAt: new Date(),
                        count: result.modifiedCount
                    });
                }
            } catch (error) {
                socket.emit('error', 'Failed to mark messages as read');
            }
        });

        // Typing indicators(sin cambios)
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

        // ✅ Group events con invalidación de Redis cache
        socket.on('users_added_to_group', async (data: { chatId: string; userIds: string[] }) => {
            if (!socket.user) return;

            await this.invalidateChatCache(data.chatId, data.userIds);

            this.io?.to(`chat-${data.chatId}`).emit('users_added_to_group', {
                chatId: data.chatId,
                userIds: data.userIds,
                addedBy: socket.user._id
            });
        });

        socket.on('users_removed_from_group', async (data: { chatId: string; userIds: string[] }) => {
            if (!socket.user) return;

            await this.invalidateChatCache(data.chatId, data.userIds);

            this.io?.to(`chat-${data.chatId}`).emit('users_removed_from_group', {
                chatId: data.chatId,
                userIds: data.userIds,
                removedBy: socket.user._id
            });
        });

        socket.on('group_info_updated', (data: { chatId: string; groupName?: string; groupDescription?: string }) => {
            if (!socket.user) return;
            this.io?.to(`chat-${data.chatId}`).emit('group_info_updated', {
                chatId: data.chatId,
                groupName: data.groupName,
                groupDescription: data.groupDescription,
                updatedBy: socket.user._id
            });
        });

        socket.on('user_left_group', async (data: { chatId: string; userId: string }) => {
            if (!socket.user) return;

            await this.invalidateChatCache(data.chatId, [data.userId]);

            this.io?.to(`chat-${data.chatId}`).emit('user_left_group', {
                chatId: data.chatId,
                userId: data.userId
            });
        });

        // ✅ Get Users Presence (Bulk)
        socket.on('get_users_presence', async (data: { userIds: string[] }) => {
            if (!socket.user || !redis || !Array.isArray(data.userIds)) return;

            try {
                const pipeline = redis.pipeline();
                data.userIds.forEach(id => pipeline.get(`user:presence:${id}`));
                const results = await pipeline.exec();

                const presenceMap: Record<string, 'online' | 'offline'> = {};

                data.userIds.forEach((id, index) => {
                    // results[index] is [error, result]
                    const [err, status] = results ? results[index] : [null, null];
                    if (!err && status) {
                        presenceMap[id] = status as 'online' | 'offline';
                    } else {
                        presenceMap[id] = 'offline';
                    }
                });

                socket.emit('users_presence_info', presenceMap);
            } catch (error) {
                logger.error(`Error fetching users presence: ${error}`);
            }
        });

        socket.on('disconnect', () => {
            if (socket.user) {
                this.handleUserPresence(socket, 'offline');
                logger.info(`[ChatModule] User ${socket.user.firstName} disconnected`);
            }
        });
    }

    private async handleUserPresence(socket: AuthenticatedSocket, status: 'online' | 'offline'): Promise<void> {
        if (!socket.user) return;

        const userId = socket.user._id.toString();

        try {
            // ✅ Persist in Redis
            if (redis) {
                const key = `user:presence:${userId}`;
                if (status === 'online') {
                    // No TTL for online status, or maybe a long one? 
                    // Let's set it without TTL for now, or maybe 24h to avoid slate data?
                    // "online" usually implies an active connection.
                    await redis.set(key, status);
                } else {
                    // When offline, we can remove the key or set to offline
                    await redis.set(key, status);
                }
            }

            const userChats = await Chat.find({
                participants: userId,
                isActive: true
            }).select('_id').lean();

            const presenceData = {
                userId,
                status,
                timestamp: new Date().toISOString()
            };

            const rooms = userChats.map(chat => `chat-${chat._id}`);
            rooms.forEach(room => {
                this.io?.to(room).emit('user_presence_update', presenceData);
            });

            logger.info(`[ChatModule] User ${socket.user.firstName} is now ${status}`);
        } catch (error) {
            logger.error(`Error handling user presence: ${error}`);
        }
    }
}

export default ChatModule;
