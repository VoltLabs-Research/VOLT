import { ChatProps } from "../../../domain/entities/Chat";

export enum GroupAdminAction{
    Add = 'add',
    Remove = 'remove'
};

export interface UpdateGroupAdminsInputDTO{
    requesterId: string;
    chatId: string;
    targetUserIds: string[];
    action: GroupAdminAction;
};

export interface UpdateGroupAdminsOutputDTO extends ChatProps{}