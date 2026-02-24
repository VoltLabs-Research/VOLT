export interface ListSecretKeysByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
}

export interface SecretKeyListItemDTO {
    id: string;
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ListSecretKeysByTeamIdOutputDTO {
    data: SecretKeyListItemDTO[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}
