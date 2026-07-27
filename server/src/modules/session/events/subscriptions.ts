import SessionModel from '@modules/session/models/SessionModel';
import { deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnUserDeleted(SessionModel, { className: 'SessionsDeletedOnUserDeletedHandler' });
