import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/persistence/BaseModel';
import { ReferenceColumn } from '@shared/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type { IListingsWithExposures } from '@volt/contracts/modules/plugin/exposure';
import type { PluginExposureProps } from '@modules/plugin/contracts/plugin';
import type { IArgumentDefinition, IModifierData, IWorkflow } from '@volt/contracts/modules/plugin/workflow';

@Entity('plugins')
@Index(['team'])
export default class Plugin extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('simple-json')
    workflow!: IWorkflow;

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
    modifier!: IModifierData | null;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    exposures!: PluginExposureProps[];

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    arguments!: IArgumentDefinition[];

    @Column({
        type: 'simple-json',
        nullable: true
    })
    listingExposures!: IListingsWithExposures | null;
}
