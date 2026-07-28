import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';

@Entity('teams')
@Index(['inviteCode'], {
    unique: true,
    where: '"inviteCode" IS NOT NULL'
})
export default class Team extends BaseModel{
    @Column('varchar')
    name!: string;

    @Column({
        type: 'varchar',
        nullable: true
    })
    description!: string | null;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'owner' })
    ownerRef?: User;

    @ReferenceColumn()
    owner!: string;

    @Column({
        type: 'varchar',
        nullable: true
    })
    inviteCode!: string | null;
}
