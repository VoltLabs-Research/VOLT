export interface SecretKey {
    id: string;
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    isActive: boolean;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
}
