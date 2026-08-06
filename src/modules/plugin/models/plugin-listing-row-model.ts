import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { JsonObject } from '@shared/contracts/types/json';

/**
 * One summary row per (analysis, exposure, timestep).
 *
 * `row` stays an open object because its keys are the plugin's own output columns:
 * every plugin reports a different set and the listing UI derives its columns from
 * whatever is present. That is the one part of the shape that must not be pinned
 * down, so it lives in `jsonb` while the identifying fields stay typed.
 */
@Entity('plugin_listing_rows')
@Index(['analysis', 'exposureId', 'timestep'])
@Index(['analysis', 'timestep'])
@Index(['plugin', 'trajectory', 'timestep'])
@Index(['trajectory'])
export class PluginListingRow {
    /*
     * Derived from the natural key rather than generated, so re-importing a row into
     * another cluster during a storage transfer is idempotent. A random id would
     * duplicate the row on every retry.
     */
    @PrimaryColumn('varchar')
    _id!: string;

    @Column('varchar')
    plugin!: string;

    @Column('varchar')
    team!: string;

    @Column('varchar')
    trajectory!: string;

    @Column('varchar')
    analysis!: string;

    @Column('varchar')
    exposureId!: string;

    @Column('varchar')
    exposureName!: string;

    /* Timesteps are simulation step counts and routinely exceed 2^31. */
    @Column('bigint', {
        transformer: {
            to: (value: number): number => value,
            from: (value: string | number): number => Number(value)
        }
    })
    timestep!: number;

    @Column('jsonb', { default: () => '\'{}\'::jsonb' })
    row!: JsonObject;

    @Column('varchar', { nullable: true })
    propertyObjectKey?: string | null;

    @Column('varchar', { nullable: true })
    propertyOwnerClusterId?: string | null;

    @Column('jsonb', { default: () => '\'[]\'::jsonb' })
    subListingNames!: string[];
}

/** The identity a listing row is addressed by wherever it crosses a boundary. */
export const buildPluginListingRowId = (
    analysis: string,
    exposureId: string,
    timestep: number
): string => `${analysis}:${exposureId}:${timestep}`;

export type PluginListingRowDocument = PluginListingRow;
