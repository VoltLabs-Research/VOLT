import { post, patch, del } from '@/app/core/http/utilities/create-service';
import type { Chat } from '../../../entities/chat';
import type { CreateGroupChatDTO } from '../../../dtos/create-group-chat';
import type { AddUsersToGroupInputDTO } from '../../../dtos/add-users-to-group';
import type { RemoveUsersFromGroupInputDTO } from '../../../dtos/remove-users-from-group';
import type { UpdateGroupInfoInputDTO } from '../../../dtos/update-group-info';
import type { UpdateGroupAdminsInputDTO } from '../../../dtos/update-group-admins';

const endpoints = {
    createGroup: post<CreateGroupChatDTO, Chat>('/groups'),
    addUsersToGroup: post<AddUsersToGroupInputDTO, Chat>('/:chatId/users'),
    removeUsersFromGroup: del<RemoveUsersFromGroupInputDTO, Chat>('/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoInputDTO, Chat>('/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsInputDTO, Chat>('/:chatId/admins'),
    leaveGroup: del<{ chatId: string }, void>('/:chatId/participants/self', { unwrap: 'void' })
};

export default endpoints;
