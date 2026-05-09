import { createService, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { Chat } from '../entities/chat';

export interface AddUsersToGroupInputDTO {
    chatId: string;
    userIds: string[];
}

export interface CreateGroupChatDTO {
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
}

export interface RemoveUsersFromGroupInputDTO {
    chatId: string;
    userIds: string[];
}

export interface UpdateGroupAdminsDTO {
    targetUserIds: string[];
    action: 'add' | 'remove';
}

export type UpdateGroupAdminsInputDTO = { chatId: string } & UpdateGroupAdminsDTO;

export interface UpdateGroupInfoDTO {
    groupName?: string;
    groupDescription?: string;
}

export type UpdateGroupInfoInputDTO = { chatId: string } & UpdateGroupInfoDTO;

interface LeaveGroupParams {
    chatId: string;
}

const endpoints = {
    createGroup: post<CreateGroupChatDTO, Chat>('/groups'),
    addUsersToGroup: post<AddUsersToGroupInputDTO, Chat>('/:chatId/users'),
    removeUsersFromGroup: del<RemoveUsersFromGroupInputDTO, Chat>('/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoInputDTO, Chat>('/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsInputDTO, Chat>('/:chatId/admins'),
    leaveGroup: del<LeaveGroupParams, void>('/:chatId/participants/self', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/chats'
        }
    }
}, endpoints);
