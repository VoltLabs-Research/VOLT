export interface RevokeSecretKeyByIdInputDTO {
    teamId: string;
    secretKeyId: string;
}

export interface RevokeSecretKeyByIdOutputDTO {
    id: string;
    teamId: string;
    isActive: boolean;
    updatedAt: Date;
}
