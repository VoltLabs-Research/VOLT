import {
    MessageOutputDTO,
    UserScopedEntityIdInputDTO
} from '@modules/team/application/dtos/common';

export type TeamInvitationActionInputDTO = UserScopedEntityIdInputDTO<'invitationId'>;

export type TeamInvitationActionOutputDTO = MessageOutputDTO;
