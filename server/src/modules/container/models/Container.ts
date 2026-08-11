import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import User from '@modules/auth/models/User';
import type { ContainerEnvironmentVariable, ContainerPortMapping } from '@shared/contracts/ports/ContainerRuntime';

@Entity('containers')
@Index(['team', 'folder', 'createdAt'])
@Index(['team', 'updatedAt'])
export default class Container extends BaseModel{
    @Column('varchar')
    name!: string;

    @Column('varchar')
    image!: string;

    @Column({
        type: 'varchar',
        unique: true
    })
    containerId!: string;

    @ManyToOne(() => CatalogFolder, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'folder' })
    folderRef?: CatalogFolder;

    @ReferenceColumn({ nullable: true })
    folder!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    internalIp!: string | null;

    @ManyToOne(() => Team, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn({ nullable: true })
    team!: string | null;

    @ManyToOne(() => TeamCluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teamCluster' })
    teamClusterRef?: TeamCluster;

    @ReferenceColumn()
    teamCluster!: string;

    @Column({
        type: 'varchar',
        default: 'created'
    })
    status!: string;

    @Column({
        type: 'integer',
        default: 512
    })
    memory!: number;

    @Column({
        type: 'real',
        default: 1
    })
    cpus!: number;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    env!: ContainerEnvironmentVariable[];

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    ports!: ContainerPortMapping[];

    @Column({
        type: 'boolean',
        default: false
    })
    mountDockerSocket!: boolean;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;
}
