/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 * LIABILITY, WHETHER IN AN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Request, Response } from 'express';
import { Chat, Message, Team } from '@/models/index';
import { catchAsync } from '@/utilities/runtime/runtime';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { uploadSingleFile, getFileUrl, uploadToMinIO } from '@/middlewares/file-upload';
import { Action } from '@/constants/permissions';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';

export default class ChatController extends BaseController<any> {
    constructor() {
        super(Chat, {
            resource: Resource.CHAT
        });
    }

    protected async getTeamId(req: Request, doc?: any): Promise<string | null> {
        if (doc?.team) {
            return typeof doc.team === 'string' ? doc.team : doc.team._id?.toString() || doc.team.toString();
        }
        const teamId = req.params?.teamId || req.body?.teamId;
        return teamId ? String(teamId) : null;
    }

    private static readonly POPULATE_FIELDS = {
        user: 'firstName lastName email avatar',
        team: 'name description',
        teamWithMembers: 'name description members owner'
    };

    private static readonly CHAT_POPULATES = [
        { path: 'participants', select: this.POPULATE_FIELDS.user },
        { path: 'admins', select: this.POPULATE_FIELDS.user },
        { path: 'createdBy', select: this.POPULATE_FIELDS.user },
        { path: 'lastMessage' },
        { path: 'team', select: 'name' }
    ];

    public getChats = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;

        const userTeams = await Team.find({
            $or: [
                { owner: user._id },
                { members: user._id }
            ]
        }).select('_id');

        const teamIds = userTeams.map((team) => team._id);

        const chats = await Chat.find({
            team: { $in: teamIds },
            isActive: true
        })
            .populate(ChatController.CHAT_POPULATES)
            .sort({ lastMessageAt: -1 });

        res.status(200).json({ status: 'success', data: chats });
    });

    public getOrCreateChat = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { participantId, teamId } = req.params;

        let chat = await Chat.findOne({
            participants: { $all: [user._id, participantId] },
            team: teamId
        }).populate(ChatController.CHAT_POPULATES);

        if(!chat){
            chat = await Chat.create({
                participants: [user._id, participantId],
                team: teamId,
                isActive: true
            });
            await chat.populate(ChatController.CHAT_POPULATES);
        }

        res.status(200).json({ status: 'success', data: chat });
    });

    public getChatMessages = catchAsync(async (req: Request, res: Response) => {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const messages = await Message.find({ chat: chatId })
            .populate('sender', 'firstName lastName email')
            .populate('readBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        res.status(200).json({
            status: 'success',
            data: messages.reverse()
        });
    });

    public sendMessage = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { chatId } = req.params;
        const { content, messageType = 'text', metadata } = req.body;

        const message = await Message.create({
            chat: chatId,
            sender: user._id,
            content,
            messageType,
            metadata,
            readBy: [user._id]
        });

        await message.populate('sender', 'firstName lastName email');
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: message._id,
            lastMessageAt: new Date()
        });

        res.status(201).json({ status: 'success', data: message });
    });

    public editMessage = catchAsync(async (req: Request, res: Response) => {
        const { content } = req.body as any;
        const { message } = req as any;

        message.content = content;
        message.editedAt = new Date();
        await message.save();
        await message.populate('sender', 'firstName lastName email');

        res.status(200).json({ status: 'success', data: message });
    });

    public deleteMessage = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { message } = req as any;

        message.deleted = true;
        message.deletedAt = new Date();
        message.deletedBy = user._id;

        await message.save();

        res.status(200).json({ status: 'success', data: { _id: message._id, deleted: true } });
    });

    public markMessagesAsRead = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { chatId } = req.params;

        await Message.updateMany({
            chat: chatId,
            sender: { $ne: user._id },
            readBy: { $ne: user._id }
        }, { $addToSet: { readBy: user._id } });

        res.status(200).json({
            status: 'success',
            message: 'Messages marked as read'
        });
    });

    public getTeamMembers = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { teamId } = req.params;

        const team = await Team.findOne({
            _id: teamId,
            $or: [
                { owner: user._id },
                { members: user._id }
            ]
        }).populate('owner members', 'firstName lastName email');

        if (!team) {
            throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);
        }

        const allMembers = [
            ...(team.owner ? [team.owner] : []),
            ...(team.members || [])
        ].filter(member => member._id.toString() !== user._id.toString());

        res.status(200).json({ status: 'success', data: allMembers });
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
                const filename = await uploadToMinIO(req.file.buffer, req.file.originalname, req.file.mimetype);
                const fileUrl = getFileUrl(filename);

                res.status(200).json({
                    status: 'success',
                    data: {
                        filename,
                        originalName: req.file.originalname,
                        size: req.file.size,
                        mimetype: req.file.mimetype,
                        url: fileUrl
                    }
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
        const { filename, originalName, size, mimetype, url } = req.body;

        const message = await Message.create({
            chat: chatId,
            sender: user._id,
            content: originalName,
            messageType: 'file',
            metadata: {
                fileName: originalName,
                fileSize: size,
                fileType: mimetype,
                fileUrl: url,
                filePath: filename
            },
            readBy: [user._id]
        });

        await message.populate('sender', 'firstName lastName email');
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: message._id,
            lastMessageAt: new Date()
        });

        res.status(201).json({ status: 'success', data: message });
    });
}
