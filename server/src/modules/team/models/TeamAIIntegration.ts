import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { Hidden } from '@shared/infrastructure/persistence/Hidden';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import type { AIProvider } from '@shared/contracts/types/AIProviders';
import type { EnabledModel } from '@volt/contracts/modules/team/domain';

@Entity('team_ai_integrations')
@Index(['team', 'provider'], { unique: true })
@Index(['team', 'isEnabled'])
export default class TeamAIIntegration extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('varchar')
    provider!: AIProvider;

    @Column('varchar')
    @Hidden()
    encryptedApiKey!: string;

    @Column({
        type: 'boolean',
        default: true
    })
    isEnabled!: boolean;

    @Column({
        type: 'varchar',
        nullable: true
    })
    defaultModel!: string | null;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    enabledModels!: EnabledModel[];

    @Column({
        type: 'simple-json',
        default: '{}'
    })
    metadata!: Record<string, unknown>;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;
}
