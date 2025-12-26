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
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Chat, User, Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import { CHAT_POPULATES, populateChatDoc } from '@/middlewares/validation';

export default class GroupChatController {
    public createGroupChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const { teamId, groupName, groupDescription, participantIds } = req.body;

        if (!teamId || teamId.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Team ID is required' });
        }

        if (!mongoose.Types.ObjectId.isValid(teamId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid Team ID format' });
        }

        if (!groupName || groupName.trim() === '') {
            return res.status(400).json({ status: 'error', message: 'Group name is required' });
        }

        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            return res.status(400).json({ status: 'error', message: 'At least one participant is required' });
        }

        const invalidParticipantIds = participantIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidParticipantIds.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid participant ID format' });
        }

        const team = await Team.findOne({
            _id: teamId,
            $or: [
                { owner: user._id },
                { members: user._id }
            ]
        });

        if (!team) throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);

        const participants = await User.find({
            _id: { $in: participantIds },
            $or: [
                { _id: { $in: team.members } },
                { _id: team.owner }
            ]
        });

        if (participants.length !== participantIds.length) {
            throw new RuntimeError(ErrorCodes.CHAT_PARTICIPANTS_NOT_IN_TEAM, 400);
        }

        const groupChat = await Chat.create({
            participants: [user._id, ...participantIds],
            team: teamId,
            isGroup: true,
            groupName,
            groupDescription: groupDescription || '',
            admins: [user._id],
            createdBy: user._id,
            isActive: true
        });

        await populateChatDoc(groupChat);

        res.status(201).json({ status: 'success', data: groupChat });
    });

    public addUsersToGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const { chatId } = req.params;
        const { userIds } = req.body;

        const chat = await Chat.findOne({
            _id: chatId,
            isGroup: true,
            admins: user._id,
            isActive: true
        });

        if (!chat) throw new RuntimeError(ErrorCodes.CHAT_NOT_FOUND, 404);

        const team = await Team.findById(chat.team);
        if (!team) throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);

        const users = await User.find({
            _id: { $in: userIds },
            $or: [
                { _id: { $in: team.members } },
                { _id: team.owner }
            ]
        });

        if (users.length !== userIds.length) {
            throw new RuntimeError(ErrorCodes.CHAT_USERS_NOT_IN_TEAM, 400);
        }

        const newParticipants = [...new Set([...chat.participants.map(p => p.toString()), ...userIds])];
        await Chat.findByIdAndUpdate(chatId, { participants: newParticipants });

        const updatedChat = await Chat.findById(chatId).populate(CHAT_POPULATES as any);

        res.status(200).json({ status: 'success', data: updatedChat });
    });

    public removeUsersFromGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const { chatId } = req.params;
        const { userIds } = req.body;

        const chat = await Chat.findOne({
            _id: chatId,
            isGroup: true,
            admins: user._id,
            isActive: true
        });

        if (!chat) throw new RuntimeError(ErrorCodes.CHAT_NOT_FOUND, 404);

        const updatedParticipants = chat.participants.filter(p => !userIds.includes(p.toString()));
        if (updatedParticipants.length < 2) throw new RuntimeError(ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS, 400);

        const updatedAdmins = chat.admins.filter(a => !userIds.includes(a.toString()));
        await Chat.findByIdAndUpdate(chatId, { participants: updatedParticipants, admins: updatedAdmins });

        const updatedChat = await Chat.findById(chatId).populate(CHAT_POPULATES as any);

        res.status(200).json({ status: 'success', data: updatedChat });
    });

    public updateGroupInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const { chatId } = req.params;
        const { groupName, groupDescription } = req.body;

        const chat = await Chat.findOne({
            _id: chatId,
            isGroup: true,
            admins: user._id,
            isActive: true
        });

        if (!chat) throw new RuntimeError(ErrorCodes.CHAT_NOT_FOUND, 404);

        const updateData: any = {};
        if (groupName !== undefined) updateData.groupName = groupName;
        if (groupDescription !== undefined) updateData.groupDescription = groupDescription;

        await Chat.findByIdAndUpdate(chatId, updateData);

        const updatedChat = await Chat.findById(chatId).populate(CHAT_POPULATES as any);

        res.status(200).json({ status: 'success', data: updatedChat });
    });

    public updateGroupAdmins = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const { chatId } = req.params;
        const { userIds, action } = req.body;

        const chat = await Chat.findOne({
            _id: chatId,
            isGroup: true,
            admins: user._id,
            isActive: true
        });

        if (!chat) throw new RuntimeError(ErrorCodes.CHAT_NOT_FOUND, 404);

        const validUsers = userIds.filter((id: string) => chat.participants.some(p => p.toString() === id));

        if (validUsers.length !== userIds.length) {
            throw new RuntimeError(ErrorCodes.CHAT_USERS_NOT_PARTICIPANTS, 400);
        }

        let updatedAdmins;
        if (action === 'add') {
            updatedAdmins = [...new Set([...chat.admins.map(a => a.toString()), ...validUsers])];
        } else if (action === 'remove') {
            updatedAdmins = chat.admins.filter(a => !validUsers.includes(a.toString()));
            if (updatedAdmins.length === 0) throw new RuntimeError(ErrorCodes.CHAT_GROUP_MIN_ADMINS, 400);
        } else {
            throw new RuntimeError(ErrorCodes.CHAT_INVALID_ACTION, 400);
        }

        await Chat.findByIdAndUpdate(chatId, { admins: updatedAdmins });

        const updatedChat = await Chat.findById(chatId).populate(CHAT_POPULATES as any);

        res.status(200).json({ status: 'success', data: updatedChat });
    });

    public leaveGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const { chatId } = req.params;

        const chat = await Chat.findOne({
            _id: chatId,
            isGroup: true,
            participants: user._id,
            isActive: true
        });

        if (!chat) throw new RuntimeError(ErrorCodes.CHAT_NOT_FOUND, 404);

        const updatedParticipants = chat.participants.filter(p => p.toString() !== user._id.toString());
        const updatedAdmins = chat.admins.filter(a => a.toString() !== user._id.toString());

        if (updatedAdmins.length === 0 && chat.createdBy) {
            updatedAdmins.push(chat.createdBy);
        }

        if (updatedParticipants.length < 2) {
            await Chat.findByIdAndUpdate(chatId, { isActive: false });
        } else {
            await Chat.findByIdAndUpdate(chatId, {
                participants: updatedParticipants,
                admins: updatedAdmins
            });
        }

        res.status(200).json({ status: 'success', message: 'Left group successfully' });
    });
}
