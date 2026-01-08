import { Request, Response } from 'express';
import { TeamInvitation } from '@/models/index';
import { catchAsync } from '@/utilities/runtime/runtime';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import teamInvitationService from '@/services/team/invitation';

export default class TeamInvitationController extends BaseController<any> {
    constructor() {
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

        const invitation = await teamInvitationService.sendInvitation(team, userId, email, role);

        res.status(201).json({
            status: 'success',
            message: `Invitation sent to ${email}`,
            data: { invitation }
        });
    });

    /**
     * Cancel/revoke a pending invitation.
     */
    public cancelInvitation = catchAsync(async (req: Request, res: Response) => {
        const { invitationId } = req.params;
        const team = res.locals.team;

        await teamInvitationService.cancelInvitation(team._id, invitationId);

        res.status(200).json({
            status: 'success',
            message: 'Invitation cancelled'
        });
    });

    public getPendingInvitations = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        const invitations = await teamInvitationService.getPendingInvitations(teamId);

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
        const userEmail = (req as any).user?.email;
        const invitation = res.locals.invitation;

        const team = await teamInvitationService.acceptInvitation(invitation, userId, userEmail);

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
        await teamInvitationService.rejectInvitation(invitation);

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
        const invitationData = await teamInvitationService.getInvitationDetails(invitation);

        res.status(200).json({
            status: 'success',
            data: { invitation: invitationData }
        });
    });
}
