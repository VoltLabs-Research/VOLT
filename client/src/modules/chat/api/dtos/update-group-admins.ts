export interface UpdateGroupAdminsDTO {
    targetUserIds: string[];
    action: 'add' | 'remove';
};

export interface UpdateGroupAdminsInputDTO {
    chatId: string;
    targetUserIds: string[];
    action: 'add' | 'remove';
};
