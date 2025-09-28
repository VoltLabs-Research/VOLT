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
import { Chat, User, Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime-error';
import { catchAsync } from '@/utilities/runtime';
import mongoose from 'mongoose';

/**
 * Create a group chat
 */
export const createGroupChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { teamId, groupName, groupDescription, participantIds } = req.body;

    // Validate required fields
    if (!teamId || teamId.trim() === '') {
        return res.status(400).json({
            status: 'error',
            message: 'Team ID is required'
        });
    }

    // Validate teamId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid Team ID format'
        });
    }

    if (!groupName || groupName.trim() === '') {
        return res.status(400).json({
            status: 'error',
            message: 'Group name is required'
        });
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({
            status: 'error',
            message: 'At least one participant is required'
        });
    }

    // Validate all participant IDs are valid ObjectIds
    const invalidParticipantIds = participantIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidParticipantIds.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid participant ID format'
        });
    }

    // Verify user is in the team
    const team = await Team.findOne({
        _id: teamId,
        $or: [
            { owner: user._id },
            { members: user._id }
        ]
    });

    if (!team) {
        throw new RuntimeError('Team::NotFound', 404);
    }

    // Verify all participants are in the team
    const participants = await User.find({
        _id: { $in: participantIds },
        $or: [
            { _id: { $in: team.members } },
            { _id: team.owner }
        ]
    });

    if (participants.length !== participantIds.length) {
        throw new RuntimeError('Chat::Participants::NotInTeam', 400);
    }

    // Create new group chat
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

    await groupChat.populate('participants', 'firstName lastName email');
    await groupChat.populate('admins', 'firstName lastName email');
    await groupChat.populate('createdBy', 'firstName lastName email');
    await groupChat.populate('team', 'name');

    res.status(201).json({
        status: 'success',
        data: groupChat
    });
});

/**
 * Add users to group chat
 */
export const addUsersToGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;
    const { userIds } = req.body;

    // Verify user is admin of the group
    const chat = await Chat.findOne({
        _id: chatId,
        isGroup: true,
        admins: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Verify all users are in the same team
    const team = await Team.findById(chat.team);
    if (!team) {
        throw new RuntimeError('Team::NotFound', 404);
    }

    const users = await User.find({
        _id: { $in: userIds },
        $or: [
            { _id: { $in: team.members } },
            { _id: team.owner }
        ]
    });

    if (users.length !== userIds.length) {
        throw new RuntimeError('Chat::Users::NotInTeam', 400);
    }

    // Add users to group (avoid duplicates)
    const newParticipants = [...new Set([...chat.participants.map(p => p.toString()), ...userIds])];
    
    await Chat.findByIdAndUpdate(chatId, {
        participants: newParticipants
    });

    const updatedChat = await Chat.findById(chatId)
        .populate('participants', 'firstName lastName email')
        .populate('admins', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('team', 'name');

    res.status(200).json({
        status: 'success',
        data: updatedChat
    });
});

/**
 * Remove users from group chat
 */
export const removeUsersFromGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;
    const { userIds } = req.body;

    // Verify user is admin of the group
    const chat = await Chat.findOne({
        _id: chatId,
        isGroup: true,
        admins: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Remove users from group
    const updatedParticipants = chat.participants.filter(p => !userIds.includes(p.toString()));
    
    // Ensure at least 2 participants remain
    if (updatedParticipants.length < 2) {
        throw new RuntimeError('Chat::Group::MinParticipants', 400);
    }

    // Remove from admins if they were admins
    const updatedAdmins = chat.admins.filter(a => !userIds.includes(a.toString()));
    
    await Chat.findByIdAndUpdate(chatId, {
        participants: updatedParticipants,
        admins: updatedAdmins
    });

    const updatedChat = await Chat.findById(chatId)
        .populate('participants', 'firstName lastName email')
        .populate('admins', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('team', 'name');

    res.status(200).json({
        status: 'success',
        data: updatedChat
    });
});

/**
 * Update group information
 */
export const updateGroupInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;
    const { groupName, groupDescription } = req.body;

    // Verify user is admin of the group
    const chat = await Chat.findOne({
        _id: chatId,
        isGroup: true,
        admins: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Update group info
    const updateData: any = {};
    if (groupName !== undefined) updateData.groupName = groupName;
    if (groupDescription !== undefined) updateData.groupDescription = groupDescription;

    await Chat.findByIdAndUpdate(chatId, updateData);

    const updatedChat = await Chat.findById(chatId)
        .populate('participants', 'firstName lastName email')
        .populate('admins', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('team', 'name');

    res.status(200).json({
        status: 'success',
        data: updatedChat
    });
});

/**
 * Add/remove admin privileges
 */
export const updateGroupAdmins = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;
    const { userIds, action } = req.body; // action: 'add' or 'remove'

    // Verify user is admin of the group
    const chat = await Chat.findOne({
        _id: chatId,
        isGroup: true,
        admins: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Verify users are participants
    const validUsers = userIds.filter((id: string) => 
        chat.participants.some(p => p.toString() === id)
    );

    if (validUsers.length !== userIds.length) {
        throw new RuntimeError('Chat::Users::NotParticipants', 400);
    }

    let updatedAdmins;
    if (action === 'add') {
        updatedAdmins = [...new Set([...chat.admins.map(a => a.toString()), ...validUsers])];
    } else if (action === 'remove') {
        updatedAdmins = chat.admins.filter(a => !validUsers.includes(a.toString()));
        // Ensure at least one admin remains
        if (updatedAdmins.length === 0) {
            throw new RuntimeError('Chat::Group::MinAdmins', 400);
        }
    } else {
        throw new RuntimeError('Chat::InvalidAction', 400);
    }

    await Chat.findByIdAndUpdate(chatId, {
        admins: updatedAdmins
    });

    const updatedChat = await Chat.findById(chatId)
        .populate('participants', 'firstName lastName email')
        .populate('admins', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('team', 'name');

    res.status(200).json({
        status: 'success',
        data: updatedChat
    });
});

/**
 * Leave group chat
 */
export const leaveGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { chatId } = req.params;

    const chat = await Chat.findOne({
        _id: chatId,
        isGroup: true,
        participants: user._id,
        isActive: true
    });

    if (!chat) {
        throw new RuntimeError('Chat::NotFound', 404);
    }

    // Remove user from participants and admins
    const updatedParticipants = chat.participants.filter(p => p.toString() !== user._id.toString());
    const updatedAdmins = chat.admins.filter(a => a.toString() !== user._id.toString());

    // If user was the only admin, make the creator admin
    if (updatedAdmins.length === 0 && chat.createdBy) {
        updatedAdmins.push(chat.createdBy);
    }

    // If less than 2 participants, deactivate chat
    if (updatedParticipants.length < 2) {
        await Chat.findByIdAndUpdate(chatId, {
            isActive: false
        });
    } else {
        await Chat.findByIdAndUpdate(chatId, {
            participants: updatedParticipants,
            admins: updatedAdmins
        });
    }

    res.status(200).json({
        status: 'success',
        message: 'Left group successfully'
    });
});
