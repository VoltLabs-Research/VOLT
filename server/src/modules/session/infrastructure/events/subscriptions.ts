import SessionRepository from '@modules/session/infrastructure/persistence/mongo/repositories/SessionRepository';
import { deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnUserDeleted(SessionRepository);
