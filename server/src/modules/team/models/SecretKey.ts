import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { Hidden } from '@shared/infrastructure/persistence/Hidden';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import TeamRole from '@modules/team/models/TeamRole';

@Entity('secret_keys')
@Index(['team', 'isActive', 'createdAt'])
@Index(['team', 'role'])
@Index(['team', 'keyPrefix'])
export default class SecretKey extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => TeamRole, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role' })
    roleRef?: TeamRole;

    @ReferenceColumn()
    role!: string;

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
