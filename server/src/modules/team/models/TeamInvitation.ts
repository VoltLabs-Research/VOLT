import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamRole from '@modules/team/models/TeamRole';
import { TeamInvitationStatus } from '@volt/contracts/modules/team/domain';

@Entity('team_invitations')
@Index(['team'])
@Index(['invitedUser'])
@Index(['email'])
@Index(['status'])
export default class TeamInvitation extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'invitedBy' })
    invitedByRef?: User;

    @ReferenceColumn()
    invitedBy!: string;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'invitedUser' })
    invitedUserRef?: User;

    @ReferenceColumn({ nullable: true })
    invitedUser!: string | null;

    @Column('varchar')
    email!: string;

    @Column({
        type: 'varchar',
        unique: true
    })
    token!: string;

    @ManyToOne(() => TeamRole, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role' })
    roleRef?: TeamRole;

    @ReferenceColumn()
    role!: string;

    @Column({ type: Date })
    expiresAt!: Date;

    @Column({
        type: Date,
        nullable: true
    })
    acceptedAt!: Date | null;

    @Column({
        type: 'simple-enum',
        enum: TeamInvitationStatus,
        default: TeamInvitationStatus.Pending
    })
    status!: TeamInvitationStatus;
}
