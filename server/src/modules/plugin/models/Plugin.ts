import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import { PluginStatus } from '@volt/contracts/modules/plugin/domain/enums';
import type { IListingsWithExposures } from '@volt/contracts/modules/plugin/domain/exposure';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import type { ArgumentDefinition, ModifierNodeData } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import type { PluginExposureProps } from '@modules/plugin/contracts/domain/plugin';

@Entity('plugins')
@Index(['team'])
export default class Plugin extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('simple-json')
    workflow!: WorkflowProps;

    @Column({
        type: 'simple-enum',
        enum: PluginStatus,
        default: PluginStatus.DRAFT
    })
    status!: PluginStatus;

    @Column({
        type: 'simple-json',
        nullable: true
    })
    modifier!: ModifierNodeData | null;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    exposures!: PluginExposureProps[];

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    arguments!: ArgumentDefinition[];

    @Column({
        type: 'simple-json',
        nullable: true
    })
    listingExposures!: IListingsWithExposures | null;
}
