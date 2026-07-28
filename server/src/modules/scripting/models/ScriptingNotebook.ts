import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Trajectory from '@modules/trajectory/models/Trajectory';
import User from '@modules/auth/models/User';
import type { ScriptingNotebookContent } from '@modules/scripting/contracts/domain/scripting-notebook';
import type { ScriptingNotebookContainerResources } from '@volt/contracts/modules/scripting/domain';

@Entity('scripting_notebooks')
@Index(['team', 'trajectory', 'createdAt'])
@Index(['team', 'notebookPath'], { unique: true })
export default class ScriptingNotebook extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => TeamCluster, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teamCluster' })
    teamClusterRef?: TeamCluster;

    @ReferenceColumn()
    teamCluster!: string;

    @Column({
        type: 'simple-json',
        nullable: true
    })
    containerResources!: ScriptingNotebookContainerResources | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    runtimeNotebookId!: string | null;

    @Column('varchar')
    title!: string;

    @Column('varchar')
    notebookPath!: string;

    @ManyToOne(() => Trajectory, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'trajectory' })
    trajectoryRef?: Trajectory;

    @ReferenceColumn({ nullable: true })
    trajectory!: string | null;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;

    @Column('simple-json')
    content!: ScriptingNotebookContent;

    @ReferenceColumn({ nullable: true })
    secretKeyId!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    secretKeyEncrypted!: string | null;

    @Column({
        type: Date,
        nullable: true
    })
    lastOpenedAt!: Date | null;
}
