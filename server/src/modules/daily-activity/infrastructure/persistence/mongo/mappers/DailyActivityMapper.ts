import DailyActivity from '@modules/daily-activity/domain/entities/DailyActivity';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';
import type { DailyActivityDocument } from '@modules/daily-activity/infrastructure/persistence/mongo/models/DailyActivityModel';

export default createMongoMapper<DailyActivity, DailyActivityProps, DailyActivityDocument>(DailyActivity, [
    'team',
    'user'
]);
