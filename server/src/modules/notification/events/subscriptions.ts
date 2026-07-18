import NotificationRepository from '@modules/notification/services/NotificationRepository';
import { deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnUserDeleted(new NotificationRepository(),
    { filterField: 'recipient' });
