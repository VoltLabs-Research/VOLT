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

import { Request, Response, NextFunction } from 'express';
import { Chat, Message, User, Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime-error';
import { catchAsync } from '@/utilities/runtime';
import { uploadSingleFile, getFileUrl } from '@/middlewares/file-upload';
import path from 'path';
import fs from 'fs';

/**
 * Get all chats for the current user's teams
 */
export const getChats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    // Get all teams the user belongs to
    const userTeams = await Team.find({
        $or: [
            { owner: user._id },
            { members: user._id }
        ]
    }).select('_id');

    const teamIds = userTeams.map(team => team._id);

    // Get all chats for these teams
    const chats = await Chat.find({
        team: { $in: teamIds },
        isActive: true
    })
    .populate('participants', 'firstName lastName email')
    .populate('lastMessage')
    .populate('team', 'name')
    .sort({ lastMessageAt: -1 });

    res.status(200).json({
        status: 'success',
        data: chats
    });
});

/**
 * Get or create a chat between two users in the same team
 */
export const getOrCreateChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { participantId, teamId } = req.params;

    // Verify both users are in the same team
    const team = await Team.findOne({
        _id: teamId,
        $or: [
            { owner: user._id },
            { members: user._id }
        ]
    });

    if (!team) {
        throw new RuntimeError('Chat::Team::NotFound', 404);
    }

    // Check if participant is also in the team
    const participantInTeam = await Team.findOne({
        _id: teamId,
        $or: [
            { owner: participantId },
            { members: participantId }
        ]
    });

    if (!participantInTeam) {
        throw new RuntimeError('Chat::Participant::NotInTeam', 403);
    }

    // Find existing chat or create new one
    let chat = await Chat.findOne({
        participants: { $all: [user._id, participantId] },
        team: teamId
    })
    .populate('participants', 'firstName lastName email')
    .populate('lastMessage')
    .populate('team', 'name');

    if (!chat) {
        chat = await Chat.create({
            participants: [user._id, participantId],
            team: teamId,
            isActive: true
        });

        await chat.populate('participants', 'firstName lastName email');
        await chat.populate('team', 'name');
    }

    res.status(200).json({
        status: 'success',
        data: chat
    });
});

/**
 * Get messages for a specific chat
 */
export const getChatMessages = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user has access to this chat
    const chat = await Chat.findOne({
        _id: chatId,
        participants: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const messages = await Message.find({ chat: chatId })
        .populate('sender', 'firstName lastName email')
        .populate('readBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    res.status(200).json({
        status: 'success',
        data: messages.reverse() // Return in chronological order
    });
});

/**
 * Send a message to a chat
 */
export const sendMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;
    const { content, messageType = 'text', metadata } = req.body;

    // Verify user has access to this chat
    const chat = await Chat.findOne({
        _id: chatId,
        participants: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Create the message
    const message = await Message.create({
        chat: chatId,
        sender: user._id,
        content,
        messageType,
        metadata,
        readBy: [user._id] // Sender has read their own message
    });

    await message.populate('sender', 'firstName lastName email');

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
        lastMessage: message._id,
        lastMessageAt: new Date()
    });

    res.status(201).json({
        status: 'success',
        data: message
    });
});

/**
 * Edit a message
 */
export const editMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId, messageId } = req.params as any;
    const { content } = req.body as any;

    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
        throw new RuntimeError('Message::NotFound', 404);
    }
    if (message.sender.toString() !== user._id.toString()) {
        throw new RuntimeError('Message::Forbidden', 403);
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();
    await message.populate('sender', 'firstName lastName email');

    res.status(200).json({ status: 'success', data: message });
});

/**
 * Soft delete a message
 */
export const deleteMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId, messageId } = req.params as any;

    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
        throw new RuntimeError('Message::NotFound', 404);
    }
    if (message.sender.toString() !== user._id.toString()) {
        throw new RuntimeError('Message::Forbidden', 403);
    }

    message.deleted = true;
    message.deletedAt = new Date();
    message.deletedBy = user._id;
    await message.save();

    res.status(200).json({ status: 'success', data: { _id: message._id, deleted: true } });
});

/**
 * Toggle reaction on a message
 */
export const toggleReaction = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId, messageId } = req.params as any;
    const { emoji } = req.body as any;

    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
        throw new RuntimeError('Message::NotFound', 404);
    }

    const reactions = message.reactions || [] as any[];
    const idx = reactions.findIndex(r => r.emoji === emoji);
    const userIdStr = user._id.toString();

    if (idx === -1) {
        reactions.push({ emoji, users: [user._id] });
    } else {
        const users = reactions[idx].users.map((u: any) => u.toString());
        if (users.includes(userIdStr)) {
            reactions[idx].users = reactions[idx].users.filter((u: any) => u.toString() !== userIdStr);
            if (reactions[idx].users.length === 0) reactions.splice(idx, 1);
        } else {
            reactions[idx].users.push(user._id);
        }
    }

    (message as any).reactions = reactions;
    await message.save();
    await message.populate('sender', 'firstName lastName email');

    res.status(200).json({ status: 'success', data: message });
});
/**
 * Mark messages as read
 */
export const markMessagesAsRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;

    // Verify user has access to this chat
    const chat = await Chat.findOne({
        _id: chatId,
        participants: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Mark all unread messages in this chat as read by this user
    await Message.updateMany(
        {
            chat: chatId,
            sender: { $ne: user._id }, // Don't mark own messages
            readBy: { $ne: user._id }
        },
        {
            $addToSet: { readBy: user._id }
        }
    );

    res.status(200).json({
        status: 'success',
        message: 'Messages marked as read'
    });
});

/**
 * Get team members for chat initialization
 */
export const getTeamMembers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { teamId } = req.params;

    // Verify user is in the team
    const team = await Team.findOne({
        _id: teamId,
        $or: [
            { owner: user._id },
            { members: user._id }
        ]
    }).populate('owner members', 'firstName lastName email');

    if (!team) {
        throw new RuntimeError('Team::NotFound', 404);
    }

    // Get all team members (owner + members) excluding current user
    const allMembers = [
        ...(team.owner ? [team.owner] : []),
        ...(team.members || [])
    ].filter(member => member._id.toString() !== user._id.toString());

    res.status(200).json({
        status: 'success',
        data: allMembers
    });
});

/**
 * Upload a file for a chat message
 */
export const uploadFile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;

    // Verify user has access to this chat
    const chat = await Chat.findOne({
        _id: chatId,
        participants: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Handle file upload
    uploadSingleFile(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                status: 'error',
                message: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }

        const fileUrl = getFileUrl(req.file.filename);
        
        res.status(200).json({
            status: 'success',
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: fileUrl
            }
        });
    });
});

/**
 * Serve uploaded files
 */
export const serveFile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { filename } = req.params;
    const filePath = path.join(process.cwd(), 'storage', 'uploads', 'chat-files', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        throw new RuntimeError('File::NotFound', 404);
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Send file
    res.sendFile(filePath);
});

/**
 * Send a file message to a chat
 */
export const sendFileMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;
    const { filename, originalName, size, mimetype, url } = req.body;

    // Verify user has access to this chat
    const chat = await Chat.findOne({
        _id: chatId,
        participants: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Create the file message
    const message = await Message.create({
        chat: chatId,
        sender: user._id,
        content: originalName, // Use original filename as content
        messageType: 'file',
        metadata: {
            fileName: originalName,
            fileSize: size,
            fileType: mimetype,
            fileUrl: url,
            filePath: filename
        },
        readBy: [user._id] // Sender has read their own message
    });

    await message.populate('sender', 'firstName lastName email');

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
        lastMessage: message._id,
        lastMessageAt: new Date()
    });

    res.status(201).json({
        status: 'success',
        data: message
    });
});
