import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/di/DailyActivityTokens';
import { deleteManyOnTeamDeleted, deleteManyOnUserDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(DAILY_ACTIVITY_TOKENS.DailyActivityRepository);
deleteManyOnUserDeleted(DAILY_ACTIVITY_TOKENS.DailyActivityRepository);
