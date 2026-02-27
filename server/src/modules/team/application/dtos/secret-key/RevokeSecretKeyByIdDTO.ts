export interface RevokeSecretKeyByIdInputDTO {
    teamId: string;
    secretKeyId: string;
}

export interface RevokeSecretKeyByIdOutputDTO {
    _id: string;
    teamId: string;
    isActive: boolean;
    updatedAt: Date;
}
