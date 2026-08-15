import { Column, Entity, Index } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import type { PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';

@Entity('pipeline_runs')
@Index(['team', 'createdAt'])
@Index(['trajectory', 'createdAt'])
export default class PipelineRun extends BaseModel{
    @Column({
        type: 'varchar',
        nullable: true
    })
    name!: string | null;

    @ReferenceColumn()
    trajectory!: string;

    @ReferenceColumn()
    team!: string;

    @ReferenceColumn({ nullable: true })
    createdBy!: string | null;

    @ReferenceColumn({ nullable: true })
    computeClusterId!: string | null;

    @ReferenceColumn({ nullable: true })
    storageClusterId!: string | null;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    selectedTimesteps!: number[];

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    stages!: PipelineRunStage[];
}
