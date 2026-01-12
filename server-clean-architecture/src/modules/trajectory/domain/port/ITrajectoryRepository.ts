import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import Trajectory, { TrajectoryProps } from "../entities/Trajectory";

export interface ITrajectoryRepository extends IBaseRepository<Trajectory, TrajectoryProps>{}