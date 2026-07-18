import { MessageOutputDTO, UserScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type TeamInvitationActionInputDTO = UserScopedEntityIdInputDTO<'invitationId'>;

export type TeamInvitationActionOutputDTO = MessageOutputDTO;
