import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import SecretKey from '@modules/team/models/SecretKey';
import Team from '@modules/team/models/Team';

@Entity('secret_key_usage_logs')
@Index(['team', 'createdAt'])
@Index(['secretKey', 'createdAt'])
@Index(['team', 'secretKey', 'createdAt'])
export default class SecretKeyUsageLog extends BaseModel{
    @ManyToOne(() => SecretKey, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'secretKey' })
    secretKeyRef?: SecretKey;

    @ReferenceColumn()
    secretKey!: string;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('varchar')
    method!: string;

    @Column('varchar')
    path!: string;

    @Column('integer')
    statusCode!: number;

    @Column('integer')
    responseTime!: number;

    @Column({
        type: 'varchar',
        default: ''
    })
    ip!: string;

    @Column({
        type: 'varchar',
        default: ''
    })
    userAgent!: string;
}
