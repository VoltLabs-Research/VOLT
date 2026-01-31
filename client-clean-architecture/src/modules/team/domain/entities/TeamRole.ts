export interface TeamRole{
    _id: string;
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
};
