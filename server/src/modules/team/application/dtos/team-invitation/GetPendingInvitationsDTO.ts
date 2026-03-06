import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export interface GetPendingInvitationsInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
}

export interface GetPendingInvitationsOutputDTO extends PaginatedResult<TeamInvitationProps>{}
