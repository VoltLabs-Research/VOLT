import Trajectory, { TrajectoryProps } from "@/src/modules/trajectory/domain/entities/Trajectory";
import { TrajectoryDocument } from "../models/TrajectoryModel";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

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