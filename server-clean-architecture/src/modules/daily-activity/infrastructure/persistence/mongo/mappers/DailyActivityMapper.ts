import DailyActivity, { DailyActivityProps } from "@/src/modules/daily-activity/domain/entities/DailyActivity";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";
import { DailyActivityDocument } from "../models/DailyActivityModel";

class DailyActivityMapper extends BaseMapper<DailyActivity, DailyActivityProps, DailyActivityDocument>{
    constructor(){
        super(DailyActivity, [
            'team',
            'user'
        ]);
    }
};

export default new DailyActivityMapper();