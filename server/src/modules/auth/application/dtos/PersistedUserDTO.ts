import User, { UserProps } from '@modules/auth/domain/entities/User';

export type PersistedUserDTO = UserProps & { _id: string };

export const toPersistedUserDTO = (user: User): PersistedUserDTO => {
    return {
        _id: user._id,
        ...user.props
    };
};
