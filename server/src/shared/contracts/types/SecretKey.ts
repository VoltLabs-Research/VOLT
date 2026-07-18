import { Types } from 'mongoose';

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
    team: string | Types.ObjectId;
    role: string | Types.ObjectId | PopulatedRole;
    name: string;
    keyPrefix: string;
    keyHash: string;
    createdBy: string | Types.ObjectId | PopulatedUser;
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const isPopulatedSecretKeyRole = (value: SecretKeyProps['role']): value is PopulatedRole => (
    typeof value === 'object' && !(value instanceof Types.ObjectId)
);
