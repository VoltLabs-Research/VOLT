import Trajectory, { TrajectoryProps } from '@modules/trajectory/domain/entities/Trajectory';
import { TrajectoryDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/TrajectoryModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class TrajectoryMapper extends BaseMapper<Trajectory, TrajectoryProps, TrajectoryDocument>{
    constructor(){
        super(Trajectory, [
            'analysis',
            'createdAt',
            'team'
        ]);
    }
};

export default new TrajectoryMapper();