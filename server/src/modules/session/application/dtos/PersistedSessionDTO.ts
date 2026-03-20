import type Session from '@modules/session/domain/entities/Session';
import type { SessionProps } from '@modules/session/domain/entities/Session';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

export interface PersistedSessionDTO extends Omit<PersistedEntityOutput<SessionProps>, 'token'> {
    token: null;
};

export const toPersistedSessionDTO = (session: Session): PersistedSessionDTO => {
    return {
        _id: session._id,
        ...session.props,
        token: null
    };
};
