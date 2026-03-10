import type Session from '@modules/session/domain/entities/Session';
import type { SessionProps } from '@modules/session/domain/entities/Session';
import { toPersistedEntity, type PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

export type PersistedSessionDTO = PersistedEntityOutput<SessionProps>;

export const toPersistedSessionDTO = (session: Session): PersistedSessionDTO => {
    return toPersistedEntity(session);
};
