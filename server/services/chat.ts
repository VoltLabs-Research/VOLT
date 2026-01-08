import { Chat, Message, Team } from '@/models/index';
import { uploadToMinIO, getFileUrl, getMinIOObjectName } from '@/middlewares/file-upload';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

export class ChatService {
    private static readonly POPULATE_FIELDS = {
        user: 'firstName lastName email avatar',
        team: 'name description',
        teamWithMembers: 'name description members owner'
    };

    private static readonly CHAT_POPULATES = [
        { path: 'participants', select: ChatService.POPULATE_FIELDS.user },
        { path: 'admins', select: ChatService.POPULATE_FIELDS.user },
        { path: 'createdBy', select: ChatService.POPULATE_FIELDS.user },
        { path: 'lastMessage' },
        { path: 'team', select: 'name' }
    ];

    async getChats(user: any) {
        const userTeams = await Team.find({
            $or: [
                { owner: user._id },
                { members: user._id }
            ]
        }).select('_id');

        const teamIds = userTeams.map((team) => team._id);

        return await Chat.find({
            team: { $in: teamIds },
            isActive: true
        })
            .populate(ChatService.CHAT_POPULATES)
            .sort({ lastMessageAt: -1 });
    }

    async getOrCreateChat(user: any, participantId: string, teamId: string) {
        let chat = await Chat.findOne({
            participants: { $all: [user._id, participantId] },
            team: teamId
        }).populate(ChatService.CHAT_POPULATES);

        if (!chat) {
            chat = await Chat.create({
                participants: [user._id, participantId],
                team: teamId,
                isActive: true
            });
            await chat.populate(ChatService.CHAT_POPULATES);
        }

        return chat;
    }

    async getChatMessages(chatId: string, page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;
        const messages = await Message.find({ chat: chatId })
            .populate('sender', 'firstName lastName email avatar')
            .populate('readBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return messages.reverse();
    }

    async sendMessage(user: any, chatId: string, content: string, messageType: string = 'text', metadata?: any) {
        const message = await Message.create({
            chat: chatId,
            sender: user._id,
            content,
            messageType,
            metadata,
            readBy: [user._id]
        });

        await message.populate('sender', 'firstName lastName email avatar');
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: message._id,
            lastMessageAt: new Date()
        });

        return message;
    }

    async editMessage(message: any, content: string) {
        message.content = content;
        message.editedAt = new Date();
        await message.save();
        await message.populate('sender', 'firstName lastName email avatar');

        return message;
    }

    async deleteMessage(message: any, user: any) {
        message.deleted = true;
        message.deletedAt = new Date();
        message.deletedBy = user._id;

        await message.save();
        return { _id: message._id, deleted: true };
    }

    async markMessagesAsRead(chatId: string, userId: string) {
        await Message.updateMany({
            chat: chatId,
            sender: { $ne: userId },
            readBy: { $ne: userId }
        }, { $addToSet: { readBy: userId } });
    }

    async getTeamMembers(user: any, teamId: string) {
        const team = await Team.findOne({
            _id: teamId,
            $or: [
                { owner: user._id },
                { members: user._id }
            ]
        }).populate('owner members', 'firstName lastName email avatar');

        if (!team) {
            throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);
        }

        return [
            ...(team.owner ? [team.owner] : []),
            ...(team.members || [])
        ].filter(member => member._id.toString() !== user._id.toString());
    }

    async uploadFile(file: Express.Multer.File) {
        const filename = await uploadToMinIO(file.buffer, file.originalname, file.mimetype);
        const fileUrl = getFileUrl(filename);

        return {
            filename,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            url: fileUrl
        };
    }

    async sendFileMessage(user: any, chatId: string, fileData: any) {
        const { filename, originalName, size, mimetype, url } = fileData;
        return await this.sendMessage(user, chatId, originalName, 'file', {
            fileName: originalName,
            fileSize: size,
            fileType: mimetype,
            fileUrl: url,
            filePath: filename
        });
    }

    async getFileStream(filename: string) {
        const objectName = getMinIOObjectName(filename);

        if (!(await storage.exists(SYS_BUCKETS.CHAT, objectName))) {
            throw new RuntimeError(ErrorCodes.RESOURCE_NOT_FOUND, 404);
        }

        const stat = await storage.getStat(SYS_BUCKETS.CHAT, objectName);
        const stream = await storage.getStream(SYS_BUCKETS.CHAT, objectName);

        return { stat, stream };
    }
}

export default new ChatService();
