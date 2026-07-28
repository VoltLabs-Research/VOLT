import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';

@Entity('team_roles')
@Index(['team', 'name'], { unique: true })
@Index(['team', 'isSystem'])
export default class TeamRole extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('varchar')
    name!: string;

    @Column({
        type: 'simple-array',
        nullable: true
    })
    permissions!: string[] | null;

    @Column({
        type: 'boolean',
        default: false
    })
    isSystem!: boolean;
}
