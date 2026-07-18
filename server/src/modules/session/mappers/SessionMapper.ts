import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { createSession } from '@modules/session/entities/Session';
import type Session from '@modules/session/entities/Session';
import type { SessionProps } from '@modules/session/entities/Session';
import type { SessionDocument } from '@modules/session/models/SessionModel';

export default createMongoMapperFromFactory<Session, SessionProps, SessionDocument>(createSession, [
    'user'
]);
