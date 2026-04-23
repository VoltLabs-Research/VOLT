import DailyActivityRepository from '@modules/daily-activity/infrastructure/persistence/mongo/repositories/DailyActivityRepository';
import { deleteManyOnTeamDeleted, deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(DailyActivityRepository);
deleteManyOnUserDeleted(DailyActivityRepository);
