import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import Trajectory from '@modules/trajectory/models/Trajectory';
import type { SimulationCellDims, SimulationCellGeometry } from '@volt/contracts/modules/simulation-cell/domain';

@Entity('simulation_cells')
export default class SimulationCell extends BaseModel{
    @Column({
        type: 'simple-json',
        nullable: true
    })
    boundingBox!: SimulationCellDims | null;

    @Column({
        type: 'simple-json',
        nullable: true
    })
    geometry!: SimulationCellGeometry | null;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => Trajectory, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'trajectory' })
    trajectoryRef?: Trajectory;

    @ReferenceColumn()
    trajectory!: string;

    @Column('integer')
    timestep!: number;
}
