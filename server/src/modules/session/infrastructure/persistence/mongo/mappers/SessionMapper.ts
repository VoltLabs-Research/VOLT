import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { createSession } from '@modules/session/domain/entities/Session';
import type Session from '@modules/session/domain/entities/Session';
import type { SessionProps } from '@modules/session/domain/entities/Session';
import type { SessionDocument } from '@modules/session/infrastructure/persistence/mongo/models/SessionModel';

export default createMongoMapperFromFactory<Session, SessionProps, SessionDocument>(createSession, [
    'user'
]);
