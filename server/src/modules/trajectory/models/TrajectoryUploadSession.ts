import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import { TrajectoryUploadSessionStatus } from '@modules/trajectory/contracts/trajectory-upload-session';
import type { TrajectoryUploadSessionFileProps } from '@modules/trajectory/contracts/trajectory-upload-session';

@Entity('trajectory_upload_sessions')
@Index(['team'])
@Index(['user'])
@Index(['ownerClusterId'])
@Index(['resourceKind'])
@Index(['resourceId'])
@Index(['status'])
@Index(['team', 'resourceKind', 'resourceId', 'status'])
export default class TrajectoryUploadSession extends BaseModel{
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

    @ManyToOne(() => TeamCluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ownerClusterId' })
    ownerClusterIdRef?: TeamCluster;

    @ReferenceColumn()
    ownerClusterId!: string;

    @Column('varchar')
    bucket!: string;

    @Column('varchar')
    resourceKind!: string;

    @ReferenceColumn()
    resourceId!: string;

    @Column({
        type: 'simple-enum',
        enum: TrajectoryUploadSessionStatus,
        default: TrajectoryUploadSessionStatus.Pending
    })
    status!: TrajectoryUploadSessionStatus;

    @Column('simple-json')
    files!: TrajectoryUploadSessionFileProps[];

    @Column({ type: Date })
    expiresAt!: Date;
}
