export interface TeamRole {
    _id: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    team: string;
    createdAt: string;
    updatedAt: string;
}
