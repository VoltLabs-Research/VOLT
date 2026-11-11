import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/persistence/BaseModel';
import { Hidden } from '@shared/persistence/Hidden';
import { ReferenceColumn } from '@shared/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import { TeamRoleColumn } from '@modules/team/models/team-role-column';
import type { TeamRole } from '@volt/contracts/modules/team/access';

@Entity('secret_keys')
@Index(['team', 'isActive', 'createdAt'])
@Index(['team', 'keyPrefix'])
export default class SecretKey extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @TeamRoleColumn()
    role!: TeamRole;

    @Column('varchar')
    name!: string;

    @Column('varchar')
    keyPrefix!: string;

    @Column({
        type: 'varchar',
        unique: true
    })
    @Hidden()
    keyHash!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;

    @Column({
        type: 'boolean',
        default: true
    })
    isActive!: boolean;

    @Column({
        type: Date,
        nullable: true
    })
    lastUsedAt!: Date | null;
}
