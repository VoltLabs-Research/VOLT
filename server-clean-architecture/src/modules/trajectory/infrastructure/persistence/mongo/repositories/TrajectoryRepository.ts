import { ITrajectoryRepository } from "@/src/modules/trajectory/domain/port/ITrajectoryRepository";
import Trajectory, { TrajectoryProps } from "@/src/modules/trajectory/domain/entities/Trajectory";
import TrajectoryModel, { TrajectoryDocument } from "../models/TrajectoryModel";
import trajectoryMapper from '../mappers/TrajectoryMapper';
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";

@injectable()
export default class TrajectoryRepository
    extends MongooseBaseRepository<Trajectory, TrajectoryProps, TrajectoryDocument>
    implements ITrajectoryRepository{

    constructor(){
        super(TrajectoryModel, trajectoryMapper);
    }
};