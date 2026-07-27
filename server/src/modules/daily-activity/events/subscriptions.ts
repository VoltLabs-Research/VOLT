import DailyActivityModel from '@modules/daily-activity/models/DailyActivityModel';
import { deleteManyOnTeamDeleted, deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(DailyActivityModel, { className: 'DailyActivityTeamDeletedEventHandler' });
deleteManyOnUserDeleted(DailyActivityModel, { className: 'DailyActivityUserDeletedEventHandler' });
