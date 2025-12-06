/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { Request, Response } from 'express';
import { TeamInvitation, User, Team, Notification } from '@/models/index';
import { catchAsync } from '@/utilities/runtime/runtime';
import createHttpError from 'http-errors';
import { publishNotificationCreated } from '@/events/notification-events';

export default class TeamInvitationController {
    public sendTeamInvitation = catchAsync(async (req: Request, res: Response) => {
        const { teamId } = req.params;
        const { email, role } = req.body;
        const userId = req.user?._id;

        if (!teamId) {
            throw createHttpError(400, 'Team ID is required');
        }

        if (!email || !role) {
            throw createHttpError(400, 'Email and role are required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.toLowerCase())) {
            throw createHttpError(400, 'Invalid email format');
        }

        const team = await Team.findById(teamId);
        if (!team) {
            throw createHttpError(404, 'Team not found');
        }

        if (team.owner.toString() !== userId?.toString()) {
            throw createHttpError(403, 'Only team owner can invite members');
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (user && team.members.includes(user._id)) {
            throw createHttpError(400, 'User is already a member of this team');
        }

        const existingInvitation = await TeamInvitation.findOne({
            team: teamId,
            email: email.toLowerCase(),
            status: 'pending'
        });

        if (existingInvitation) {
            throw createHttpError(400, 'An invitation has already been sent to this email');
        }

        const token = (await import('crypto')).randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await TeamInvitation.create({
            team: teamId,
            invitedBy: userId,
            invitedUser: user?._id,
            email: email.toLowerCase(),
            role,
            token,
            expiresAt
        });

        if (user) {
            const notification = await Notification.create({
                recipient: user._id,
                title: 'Team Invitation',
                content: `You have been invited to join the team "${team.name}" as ${role.toLowerCase()}`,
                link: `/team-invitation/${invitation.token}`
            });

            await publishNotificationCreated(user._id.toString(), notification);
        }

        res.status(201).json({
            status: 'success',
            message: `Invitation sent to ${email}`,
            data: { invitation }
        });
    });

    public getPendingInvitations = catchAsync(async (req: Request, res: Response) => {
        const userId = req.user?._id;

        const invitations = await TeamInvitation.find({
            invitedUser: userId,
            status: 'pending'
        })
            .populate('team', 'name description')
            .populate('invitedBy', 'email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: { invitations }
        });
    });

    public acceptTeamInvitation = catchAsync(async (req: Request, res: Response) => {
        const { token } = req.params;
        const userId = req.user?._id;

        if (!token) {
            throw createHttpError(400, 'Invitation token is required');
        }

        const invitation = await TeamInvitation.findOne({ token });
        if (!invitation) {
            throw createHttpError(404, 'Invitation not found');
        }

        if (invitation.status !== 'pending') {
            throw createHttpError(400, `Invitation has already been ${invitation.status}`);
        }

        if (new Date() > invitation.expiresAt) {
            throw createHttpError(400, 'Invitation has expired');
        }

        if (invitation.invitedUser?.toString() !== userId?.toString()) {
            throw createHttpError(403, 'You are not authorized to accept this invitation');
        }

        const team = await Team.findByIdAndUpdate(
            invitation.team,
            { $addToSet: { members: userId } },
            { new: true }
        );

        if (!team) {
            throw createHttpError(404, 'Team not found');
        }

        await User.findByIdAndUpdate(
            userId,
            { $addToSet: { teams: invitation.team } }
        );

        invitation.status = 'accepted';
        invitation.acceptedAt = new Date();
        await invitation.save();

        await Notification.create({
            recipient: team.owner,
            title: 'Team Invitation Accepted',
            content: `${req.user?.email} has accepted the invitation to join ${team.name}`,
            link: `/dashboard?team=${team._id}`
        });

        res.status(200).json({
            status: 'success',
            message: 'Invitation accepted',
            data: { team }
        });
    });

    public rejectTeamInvitation = catchAsync(async (req: Request, res: Response) => {
        const { token } = req.params;
        const userId = req.user?._id;

        if (!token) {
            throw createHttpError(400, 'Invitation token is required');
        }

        const invitation = await TeamInvitation.findOne({ token });
        if (!invitation) {
            throw createHttpError(404, 'Invitation not found');
        }

        if (invitation.status !== 'pending') {
            throw createHttpError(400, `Invitation has already been ${invitation.status}`);
        }

        if (invitation.invitedUser?.toString() !== userId?.toString()) {
            throw createHttpError(403, 'You are not authorized to reject this invitation');
        }

        invitation.status = 'rejected';
        await invitation.save();

        res.status(200).json({
            status: 'success',
            message: 'Invitation rejected'
        });
    });

    public getInvitationDetails = catchAsync(async (req: Request, res: Response) => {
        const { token } = req.params;

        if (!token) {
            throw createHttpError(400, 'Invitation token is required');
        }

        const invitation = await TeamInvitation.findOne({ token })
            .populate('invitedBy', 'email');

        if (!invitation) {
            throw createHttpError(404, 'Invitation not found');
        }

        if (invitation.status !== 'pending') {
            throw createHttpError(400, `Invitation has already been ${invitation.status}`);
        }

        if (new Date() > invitation.expiresAt) {
            throw createHttpError(400, 'Invitation has expired');
        }

        const team = await Team.findById(invitation.team)
            .select('name description members')
            .lean();

        if (!team) {
            throw createHttpError(404, 'Team not found');
        }

        const invitationData = {
            ...invitation.toObject(),
            team: {
                _id: team._id,
                name: team.name,
                description: team.description,
                memberCount: team.members?.length || 0
            }
        };

        res.status(200).json({
            status: 'success',
            data: { invitation: invitationData }
        });
    });
}
