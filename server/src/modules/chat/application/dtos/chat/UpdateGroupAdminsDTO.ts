import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';

export enum GroupAdminAction {
    Add = 'add',
    Remove = 'remove'
};

export interface UpdateGroupAdminsInputDTO {
    userId: string;
    chatId: string;
    targetUserIds: string[];
    action: GroupAdminAction;
};

export interface UpdateGroupAdminsOutputDTO extends PersistedChatDTO {};
