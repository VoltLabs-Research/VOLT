import User from '@modules/auth/domain/entities/User';
import type { UserProps } from '@modules/auth/domain/entities/User';

interface PersistedUserIdentity {
    _id: string;
};

export type PersistedUserDTO = UserProps & PersistedUserIdentity;

export const toPersistedUserDTO = (user: User): PersistedUserDTO => {
    return {
        _id: user._id,
        ...user.props
    };
};
