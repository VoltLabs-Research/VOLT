import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';

@Entity('deployment_settings')
export default class DeploymentSettings extends BaseModel{
    @Column({
        type: 'varchar',
        unique: true,
        default: 'singleton'
    })
    key!: string;

    @ManyToOne(() => Team, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'defaultTeam' })
    defaultTeamRef?: Team;

    @ReferenceColumn({ nullable: true })
    defaultTeam!: string | null;

    @Column({
        type: 'boolean',
        default: false
    })
    autoJoinNewMembers!: boolean;
}
