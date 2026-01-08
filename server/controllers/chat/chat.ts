import { Request, Response } from 'express';
import { Chat } from '@/models/index';
import { catchAsync } from '@/utilities/runtime/runtime';
import { uploadSingleFile } from '@/middlewares/file-upload';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';
import chatService from '@/services/chat';

export default class ChatController extends BaseController<any> {
    constructor() {
        super(Chat, {
            resource: Resource.CHAT
        });
    }

    protected async getTeamId(req: Request, doc?: any): Promise<string> {
        if (doc?.team) {
            return typeof doc.team === 'string' ? doc.team : doc.team._id?.toString() || doc.team.toString();
        }
        const teamId = req.params?.teamId || req.body?.teamId;
        return teamId ? String(teamId) : '';
    }

    public getChats = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const chats = await chatService.getChats(user);
        res.status(200).json({ status: 'success', data: chats });
    });

    public getOrCreateChat = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { participantId, teamId } = req.params;

        const chat = await chatService.getOrCreateChat(user, participantId, teamId);
        res.status(200).json({ status: 'success', data: chat });
    });

    public getChatMessages = catchAsync(async (req: Request, res: Response) => {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await chatService.getChatMessages(chatId, Number(page), Number(limit));

        res.status(200).json({
            status: 'success',
            data: messages
        });
    });

    public sendMessage = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { chatId } = req.params;
        const { content, messageType, metadata } = req.body;

        const message = await chatService.sendMessage(user, chatId, content, messageType, metadata);
        res.status(201).json({ status: 'success', data: message });
    });

    public editMessage = catchAsync(async (req: Request, res: Response) => {
        const { content } = req.body as any;
        const { message } = req as any;

        const updatedMessage = await chatService.editMessage(message, content);
        res.status(200).json({ status: 'success', data: updatedMessage });
    });

    public deleteMessage = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { message } = req as any;

        const result = await chatService.deleteMessage(message, user);
        res.status(200).json({ status: 'success', data: result });
    });

    public markMessagesAsRead = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { chatId } = req.params;

        await chatService.markMessagesAsRead(chatId, user._id);

        res.status(200).json({
            status: 'success',
            message: 'Messages marked as read'
        });
    });

    public getTeamMembers = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { teamId } = req.params;

        const members = await chatService.getTeamMembers(user, teamId);
        res.status(200).json({ status: 'success', data: members });
    });

    public uploadFile = catchAsync(async (req: Request, res: Response) => {
        uploadSingleFile(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ status: 'error', message: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ status: 'error', message: 'No file uploaded' });
            }

            try {
                const data = await chatService.uploadFile(req.file);
                res.status(200).json({
                    status: 'success',
                    data
                });
            } catch (uploadErr: any) {
                return res.status(500).json({
                    status: 'error',
                    message: `Failed to upload file: ${uploadErr.message}`
                });
            }
        });
    });

    public sendFileMessage = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { chatId } = req.params;

        const message = await chatService.sendFileMessage(user, chatId, req.body);
        res.status(201).json({ status: 'success', data: message });
    });
    
    public getFile = catchAsync(async (req: Request, res: Response) => {
        const { filename } = req.params;

        const { stat, stream } = await chatService.getFileStream(filename);
        
        res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);

        if (stat.metaData['content-type']?.startsWith('image/')) {
            res.setHeader('Content-Disposition', 'inline');
        } else {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }

        stream.pipe(res);
    });
}
