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

import { Request, Response } from 'express';
import { TeamInvitation, User, Team, Notification } from '@/models/index';
import { catchAsync } from '@/utilities/runtime/runtime';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { publishNotificationCreated } from '@/events/notification-events';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';

export default class TeamInvitationController extends BaseController<any>{
    constructor(){
        super(TeamInvitation, {
            resource: Resource.TEAM_INVITATION
        });
    }

    /**
     * Send a team invitation.
     */
    public sendTeamInvitation = catchAsync(async (req: Request, res: Response) => {
        const { email, role } = req.body;
        const userId = (req as any).user?._id;
        const team = res.locals.team;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (user && team.members.includes(user._id)) {
            throw new RuntimeError(ErrorCodes.TEAM_INVITATION_USER_ALREADY_MEMBER, 400);
        }

        const existingInvitation = await TeamInvitation.findOne({
            team: team._id,
            email: email.toLowerCase(),
            status: 'pending'
        });

        if (existingInvitation) {
            throw new RuntimeError(ErrorCodes.TEAM_INVITATION_ALREADY_SENT, 400);
        }

        const token = (await import('crypto')).randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const invitation = await TeamInvitation.create({
            team: team._id,
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

    /**
     * Get pending invitations for current user.
     */
    public getPendingInvitations = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user?._id;

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

    /**
     * Accept a team invitation.
     */
    public acceptTeamInvitation = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user?._id;
        const invitation = res.locals.invitation;

        const team = await Team.findByIdAndUpdate(
            invitation.team,
            { $addToSet: { members: userId } },
            { new: true }
        );

        if (!team) {
            throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);
        }

        await User.findByIdAndUpdate(
            userId,
            { $addToSet: { teams: invitation.team } }
        );

        const { TeamRole, TeamMember } = await import('@/models/index');

        let roleToAssign = null;
        if (invitation.role) {
            roleToAssign = await TeamRole.findOne({
                team: invitation.team,
                name: invitation.role
            });
        }

        if (!roleToAssign) {
            roleToAssign = await TeamRole.findOne({
                team: invitation.team,
                name: 'Member',
                isSystem: true
            });
        }

        if (roleToAssign) {
            const existingMember = await TeamMember.findOne({
                team: invitation.team,
                user: userId
            });

            if (!existingMember) {
                await TeamMember.create({
                    team: invitation.team,
                    user: userId,
                    role: roleToAssign._id,
                    joinedAt: new Date()
                });
            }
        }

        invitation.status = 'accepted';
        invitation.acceptedAt = new Date();
        await invitation.save();

        await Notification.create({
            recipient: team.owner,
            title: 'Team Invitation Accepted',
            content: `${(req as any).user?.email} has accepted the invitation to join ${team.name}`,
            link: `/dashboard?team=${team._id}`
        });

        res.status(200).json({
            status: 'success',
            message: 'Invitation accepted',
            data: { team }
        });
    });

    /**
     * Reject a team invitation.
     */
    public rejectTeamInvitation = catchAsync(async (req: Request, res: Response) => {
        const invitation = res.locals.invitation;

        invitation.status = 'rejected';
        await invitation.save();

        res.status(200).json({
            status: 'success',
            message: 'Invitation rejected'
        });
    });

    /**
     * Get invitation details(public route for email links).
     */
    public getInvitationDetails = catchAsync(async (req: Request, res: Response) => {
        const invitation = res.locals.invitation;

        const team = await Team.findById(invitation.team)
            .select('name description members')
            .lean();

        if (!team) {
            throw new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404);
        }

        const invitedBy = await User.findById(invitation.invitedBy).select('email').lean();

        const invitationData = {
            ...invitation.toObject(),
            invitedBy,
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
