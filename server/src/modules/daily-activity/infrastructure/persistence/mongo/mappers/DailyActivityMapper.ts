import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { createDailyActivity } from '@modules/daily-activity/domain/entities/DailyActivity';
import type DailyActivity from '@modules/daily-activity/domain/entities/DailyActivity';
import type { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';
import type { DailyActivityDocument } from '@modules/daily-activity/infrastructure/persistence/mongo/models/DailyActivityModel';

export default createMongoMapperFromFactory<DailyActivity, DailyActivityProps, DailyActivityDocument>(createDailyActivity, [
    'team',
    'user'
]);
