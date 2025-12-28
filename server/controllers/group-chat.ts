import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Chat, User, Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import { Action } from '@/constants/permissions';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';

const CHAT_POPULATES = [
    { path: 'participants', select: 'firstName lastName email avatar' },
    { path: 'admins', select: 'firstName lastName email avatar' },
    { path: 'createdBy', select: 'firstName lastName email avatar' },
    { path: 'lastMessage' },
    { path: 'team', select: 'name' }
];

const populateChatDoc = async (chat: any) => {
    return chat.populate(CHAT_POPULATES);
};

export default class GroupChatController extends BaseController<any> {
    constructor() {
        super(Chat, {
            resource: Resource.GROUP_CHAT
        });
    }

    protected async getTeamId(req: Request, doc?: any): Promise<string | null> {
        if (doc?.team) {
            return typeof doc.team === 'string' ? doc.team : doc.team._id?.toString() || doc.team.toString();
        }
        return req.body?.teamId || null;
    }

    public createGroupChat = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        const { teamId, groupName, groupDescription, participantIds } = req.body;

        if (!teamId || teamId.trim() === '') {
            throw new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400);
        }

        if (!mongoose.Types.ObjectId.isValid(teamId)) {
            throw new RuntimeError(ErrorCodes.VALIDATION_INVALID_TEAM_ID, 400);
        }

        if (!groupName || groupName.trim() === '') {
            throw new RuntimeError(ErrorCodes.CHAT_INVALID_ACTION, 400);
        }

        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            throw new RuntimeError(ErrorCodes.CHAT_GROUP_MIN_PARTICIPANTS, 400);
        }

        await this.authorize(req, teamId, Action.CREATE);

        const team = await Team.findById(teamId);
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
