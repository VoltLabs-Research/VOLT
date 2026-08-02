import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import type { ActivityType } from '@volt/contracts/modules/daily-activity/domain';

@Entity('daily_activities')
@Index(['team'])
@Index(['user'])
@Index(['team', 'user', 'date'], { unique: true })
export default class DailyActivity extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user' })
    userRef?: User;

    @ReferenceColumn({ nullable: true })
    user!: string | null;

    @Column({ type: Date })
    date!: Date;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    activity!: Array<{
        type: ActivityType;
        createdAt: Date;
        description: string;
    }>;

    @Column({
        type: 'integer',
        default: 0
    })
    minutesOnline!: number;
}
