import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { Hidden } from '@shared/infrastructure/persistence/Hidden';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { resolveEffectiveCapabilitiesFromRoleConfig } from '@shared/domain/utilities/cluster-capabilities';
import type {
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterHostCapabilitiesProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterServicesProps
} from '@shared/contracts/types/TeamCluster';

@Entity('team_clusters')
@Index(['team'])
@Index(['createdBy'])
@Index(['team', 'name'], { unique: true })
@Index(['team', 'status', 'createdAt'])
@Index(['status', 'lastHeartbeatAt'])
@Index(['status', 'updatedAt'])
@Index(['team', 'isDemo'], {
    unique: true,
    where: '"isDemo" = true AND "status" NOT IN (\'deleting\', \'delete-failed\')'
})
@Index(['isDemo', 'demoExpiresAt'])
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
    queueConcurrency!: TeamClusterQueueConcurrencyProps;

    @Column('simple-json')
    queueScopeLimits!: TeamClusterQueueScopeLimitsProps;

    @Column('simple-json')
    roleConfig!: TeamClusterRuntimeRoleConfigProps;

    /* Null until the daemon's first heartbeat: an unenrolled cluster has not
       reported what its host can do, which is not the same as reporting nothing. */
    @Column({
        type: 'simple-json',
        nullable: true
    })
    hostCapabilities!: TeamClusterHostCapabilitiesProps | null;

    @Column({
        type: 'boolean',
        default: false
    })
    isDemo!: boolean;

    @Column({
        type: Date,
        nullable: true
    })
    demoExpiresAt!: Date | null;

    get effectiveCapabilities(): TeamClusterEffectiveCapabilitiesProps{
        return resolveEffectiveCapabilitiesFromRoleConfig(this.roleConfig);
    }
}
