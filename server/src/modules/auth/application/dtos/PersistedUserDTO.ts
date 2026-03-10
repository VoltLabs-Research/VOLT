import User from '@modules/auth/domain/entities/User';
import type { UserProps } from '@modules/auth/domain/entities/User';
import { toPersistedEntity, type PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

export type PersistedUserDTO = PersistedEntityOutput<UserProps>;

export const toPersistedUserDTO = (user: User): PersistedUserDTO => {
    return toPersistedEntity(user);
};
