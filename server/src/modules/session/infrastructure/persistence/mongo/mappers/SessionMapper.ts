import Session from '@modules/session/domain/entities/Session';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { SessionProps } from '@modules/session/domain/entities/Session';
import type { SessionDocument } from '@modules/session/infrastructure/persistence/mongo/models/SessionModel';

export default createMongoMapper<Session, SessionProps, SessionDocument>(Session, [
    'user'
]);
