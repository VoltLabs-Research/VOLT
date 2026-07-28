import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Trajectory from '@modules/trajectory/models/Trajectory';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';

@Entity('trajectory_frames')
@Index(['trajectoryId'])
@Unique(['trajectoryId', 'timestep'])
export default class TrajectoryFrame extends BaseModel{
    @ManyToOne(() => Trajectory, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'trajectoryId' })
    trajectoryIdRef?: Trajectory;

    @ReferenceColumn()
    trajectoryId!: string;

    @Column('integer')
    timestep!: number;

    @Column('integer')
    natoms!: number;

    @ManyToOne(() => SimulationCell, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'simulationCell' })
    simulationCellRef?: SimulationCell;

    @ReferenceColumn({ nullable: true })
    simulationCell!: string | null;
}
