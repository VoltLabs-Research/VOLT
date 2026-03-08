import type { TeamInvitation } from '../../entities/invitation';

export interface GetInvitationDetailsInputDTO {
    invitationId: string;
};

export type GetInvitationDetailsOutputDTO = TeamInvitation;
