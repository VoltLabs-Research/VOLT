import type Session from '@modules/session/domain/entities/Session';
import type { SessionProps } from '@modules/session/domain/entities/Session';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';

export type PersistedSessionDTO = PersistedOutput<SessionProps>;

export const toPersistedSessionDTO = (session: Session): PersistedSessionDTO => {
    return toPersistedOutput(session);
};
