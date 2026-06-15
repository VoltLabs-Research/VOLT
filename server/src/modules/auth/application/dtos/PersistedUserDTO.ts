import User from '@modules/auth/domain/entities/User';
import type { UserProps } from '@modules/auth/domain/entities/User';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

export type PersistedUserDTO = Omit<PersistedEntityOutput<UserProps>, 'password'>;

export const toPersistedUserDTO = (user: User): PersistedUserDTO => {
    // Never serialize the password hash to the client. `toPersistedEntity` spreads every prop,
    // so strip it here at the single boundary where a User becomes a client-facing DTO.
    const { password: _password, ...persisted } = toPersistedEntity(user);
    return persisted;
};
