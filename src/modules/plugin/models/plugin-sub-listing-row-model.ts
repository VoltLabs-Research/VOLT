import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { JsonObject } from '@shared/contracts/types/json';

/**
 * One row per entry of a named sub-listing (structures, clusters, segments…).
 *
 * These are per-entity, not per-atom, but a single analysis can still emit millions
 * of them, so every write path against this table batches.
 */
@Entity('plugin_sub_listing_rows')
@Index(['analysis', 'exposureId', 'timestep', 'subListingName'])
@Index(['analysis'])
export class PluginSubListingRow {
    /* `analysis:exposureId:timestep:subListingName:index` — see `buildPluginSubListingRowId`. */
    @PrimaryColumn('varchar')
    _id!: string;

    @Column('varchar')
    analysis!: string;

    @Column('varchar')
    exposureId!: string;

    @Column('bigint', {
        transformer: {
            to: (value: number): number => value,
            from: (value: string | number): number => Number(value)
        }
    })
    timestep!: number;

    @Column('varchar')
    subListingName!: string;

    @Column('jsonb', { default: () => '\'{}\'::jsonb' })
    row!: JsonObject;
}

/**
 * Positional and deterministic: re-running an exposure rewrites the same ids, which
 * is what lets a replace be a delete plus an upsert rather than needing to diff.
 */
export const buildPluginSubListingRowId = (
    analysis: string,
    exposureId: string,
    timestep: number,
    subListingName: string,
    index: number
): string => `${analysis}:${exposureId}:${timestep}:${subListingName}:${index}`;

export type PluginSubListingRowDocument = PluginSubListingRow;
