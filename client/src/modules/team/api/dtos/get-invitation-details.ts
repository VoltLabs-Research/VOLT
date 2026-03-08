import type { TeamInvitation } from '../entities/team-invitation';

export interface GetInvitationDetailsInputDTO {
    invitationId: string;
};

export type GetInvitationDetailsOutputDTO = TeamInvitation;
