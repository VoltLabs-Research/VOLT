import { ChatProps } from '@modules/chat/domain/entities/Chat';

export enum GroupAdminAction{
    Add = 'add',
    Remove = 'remove'
};

export interface UpdateGroupAdminsInputDTO{
    userId: string;
    chatId: string;
    targetUserIds: string[];
    action: GroupAdminAction;
};

export interface UpdateGroupAdminsOutputDTO extends ChatProps{
    _id: string;
}
