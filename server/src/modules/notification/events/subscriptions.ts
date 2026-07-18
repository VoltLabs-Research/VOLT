import NotificationRepository from '@modules/notification/repositories/NotificationRepository';
import { deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnUserDeleted(NotificationRepository,
    { filterField: 'recipient' });
