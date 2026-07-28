import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamRole from '@modules/team/models/TeamRole';

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

    @ManyToOne(() => TeamRole, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role' })
    roleRef?: TeamRole;

    @ReferenceColumn()
    role!: string;

    @Column({
        type: Date,
        default: () => 'CURRENT_TIMESTAMP'
    })
    joinedAt!: Date;
}
