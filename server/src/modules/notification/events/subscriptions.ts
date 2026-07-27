import NotificationModel from '@modules/notification/models/NotificationModel';
import { deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnUserDeleted(NotificationModel, { filterField: 'recipient' });
