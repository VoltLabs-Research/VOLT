import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/persistence/BaseModel';
import { Hidden } from '@shared/persistence/Hidden';
import { ReferenceColumn } from '@shared/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import {
    TeamClusterStatus,
    type TeamClusterEffectiveCapabilities,
    type TeamClusterHostCapabilities,
    type TeamClusterQueueConcurrency,
    type TeamClusterQueueScopeLimits,
    type TeamClusterRuntimeRoleConfig
} from '@volt/contracts/modules/cluster/domain';
import { resolveEffectiveCapabilitiesFromRoleConfig } from '@shared/utilities/cluster-capabilities';
import type { TeamClusterServicesProps } from '@shared/contracts/types/TeamCluster';

@Entity('team_clusters')
@Index(['team'])
@Index(['createdBy'])
@Index(['team', 'name'], { unique: true })
@Index(['team', 'status', 'createdAt'])
@Index(['status', 'lastHeartbeatAt'])
@Index(['status', 'updatedAt'])
export default class TeamCluster extends BaseModel{
    @Column('varchar')
    name!: string;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;

    @Column({
        type: 'simple-enum',
        enum: TeamClusterStatus,
        default: TeamClusterStatus.WaitingForConnection
    })
    status!: TeamClusterStatus;

    @Column({
        type: 'varchar',
        nullable: true
    })
    @Hidden()
    enrollmentTokenHash!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    installedVersion!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    installRoot!: string | null;

    @Column({
        type: Date,
        nullable: true
    })
    lastHeartbeatAt!: Date | null;

    @Column({
        type: Date,
        nullable: true
    })
    lastDisconnectAt!: Date | null;

    @Column('simple-json')
    @Hidden()
    services!: TeamClusterServicesProps;

    @Column('simple-json')
    queueConcurrency!: TeamClusterQueueConcurrency;

    @Column('simple-json')
    queueScopeLimits!: TeamClusterQueueScopeLimits;

    @Column('simple-json')
    roleConfig!: TeamClusterRuntimeRoleConfig;

    @Column({
        type: 'simple-json',
        nullable: true
    })
    hostCapabilities!: TeamClusterHostCapabilities | null;

    get effectiveCapabilities(): TeamClusterEffectiveCapabilities{
        return resolveEffectiveCapabilitiesFromRoleConfig(this.roleConfig);
    }
}
