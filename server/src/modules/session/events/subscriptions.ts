import SessionRepository from '@modules/session/repositories/SessionRepository';
import { deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnUserDeleted(SessionRepository);
