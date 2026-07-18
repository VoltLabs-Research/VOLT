import User from '@modules/auth/entities/User';
import type { UserProps } from '@modules/auth/entities/User';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

export type PersistedUserDTO = Omit<PersistedEntityOutput<UserProps>, 'password'>;

export const toPersistedUserDTO = (user: User): PersistedUserDTO => {
    const { password: _password, ...persisted } = toPersistedEntity(user);
    return persisted;
};
