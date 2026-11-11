import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/persistence/BaseModel';
import { ReferenceColumn } from '@shared/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import { TeamRoleColumn } from '@modules/team/models/team-role-column';
import type { TeamRole } from '@volt/contracts/modules/team/access';

@Entity('team_members')
@Index(['team', 'user'], { unique: true })
@Index(['team'])
@Index(['user'])
export default class TeamMember extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user' })
    userRef?: User;

    @ReferenceColumn()
    user!: string;

    @TeamRoleColumn()
    role!: TeamRole;

    @Column({
        type: Date,
        default: () => 'CURRENT_TIMESTAMP'
    })
    joinedAt!: Date;
}
