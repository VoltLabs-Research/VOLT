/**
 * Neutral, cross-module SecretKey data shapes + role discriminator.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): the
 * SecretKey entity class stays in `@modules/team`, but its plain prop shapes and
 * the pure `isPopulatedSecretKeyRole` discriminator live here so neutral
 * consumers (e.g. the shared auth middleware) can read a secret key's role
 * without importing the team module's entity. The entity re-exports these, so
 * existing `@modules/team/.../SecretKey` importers compile unchanged.
 */
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

export const isPopulatedSecretKeyRole = (value: SecretKeyProps['role']): value is PopulatedRole => (
    typeof value !== 'string'
);
