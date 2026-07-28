export interface PopulatedRole {
    _id: string;
    name: string;
    permissions?: string[];
}

export interface PopulatedUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
}

export interface SecretKeyProps {
    team: string;
    role: string | PopulatedRole;
    name: string;
    keyPrefix: string;
    keyHash: string;
    createdBy: string | PopulatedUser;
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
