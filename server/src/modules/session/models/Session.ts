import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';

@Entity('sessions')
@Index(['user', 'isActive'])
@Index(['token'], {
    unique: true,
    where: 'token IS NOT NULL'
})
@Index(['lastActivity'])
@Index(['action', 'createdAt'])
@Index(['success', 'createdAt'])
export default class Session extends BaseModel{
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user' })
    userRef?: User;

    @ReferenceColumn({ nullable: true })
    user!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    token!: string | null;

    @Column('varchar')
    userAgent!: string;

    @Column('varchar')
    ip!: string;

    @Column({
        type: 'boolean',
        default: true
    })
    isActive!: boolean;

    @Column({
        type: Date,
        default: () => 'CURRENT_TIMESTAMP'
    })
    lastActivity!: Date;

    @Column({
        type: 'simple-enum',
        enum: SessionActivityType,
        default: SessionActivityType.Login
    })
    action!: SessionActivityType;

    @Column({
        type: 'boolean',
        default: true
    })
    success!: boolean;
}
