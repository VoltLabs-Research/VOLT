import { Column, Entity, Index } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import type { PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';

/**
 * One `executePipeline` submission. Analyses are the *stages* of a run, so this
 * is the only place the ordered chain survives: the stage list records the
 * slice/expression transforms that leave no analysis behind, and which stages
 * were served from cache. Without it, a re-run whose stages were all cached
 * would be indistinguishable from a run that never happened.
 *
 * Two deliberate omissions:
 *
 * - **No `status` column.** A run's status is derived from its analyses, so the
 *   two can never disagree.
 * - **No `ManyToOne` relations.** References are plain columns, which keeps this
 *   file inside its own module (see `.dependency-cruiser.cjs`). The FK that
 *   would have cascaded is replaced by the `trajectory.deleted` / `team.deleted`
 *   handlers in `PluginEvents`. A run must never cascade *into* its analyses
 *   anyway: deleting history cannot delete results.
 */
@Entity('pipeline_runs')
@Index(['team', 'createdAt'])
@Index(['trajectory', 'createdAt'])
export default class PipelineRun extends BaseModel{
    /*
     * Null means "no override": the client labels the run by its plugin chain in
     * execution order. Storing the derived label at creation instead would freeze
     * a copy of the plugin names, so renaming a plugin would leave every past run
     * quoting a name that no longer exists.
     *
     * Not a `ReferenceColumn` — that one is varchar(24) for entity ids.
     */
    @Column({
        type: 'varchar',
        nullable: true
    })
    name!: string | null;

    @ReferenceColumn()
    trajectory!: string;

    @ReferenceColumn()
    team!: string;

    @ReferenceColumn({ nullable: true })
    createdBy!: string | null;

    @ReferenceColumn({ nullable: true })
    computeClusterId!: string | null;

    @ReferenceColumn({ nullable: true })
    storageClusterId!: string | null;

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    selectedTimesteps!: number[];

    @Column({
        type: 'simple-json',
        default: '[]'
    })
    stages!: PipelineRunStage[];
}
