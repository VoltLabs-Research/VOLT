import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repositories/NotificationRepository';
import { deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnUserDeleted(NotificationRepository,
    { filterField: 'recipient' });
