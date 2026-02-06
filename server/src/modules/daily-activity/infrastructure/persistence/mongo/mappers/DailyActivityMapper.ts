import DailyActivity, { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { DailyActivityDocument } from '@modules/daily-activity/infrastructure/persistence/mongo/models/DailyActivityModel';

class DailyActivityMapper extends BaseMapper<DailyActivity, DailyActivityProps, DailyActivityDocument>{
    constructor(){
        super(DailyActivity, [
            'team',
            'user'
        ]);
    }
};

export default new DailyActivityMapper();