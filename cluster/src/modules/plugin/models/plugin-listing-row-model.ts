import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { JsonObject } from '@shared/contracts/types/json';

@Entity('plugin_listing_rows')
@Index(['analysis', 'exposureId', 'timestep'])
@Index(['analysis', 'timestep'])
@Index(['plugin', 'trajectory', 'timestep'])
@Index(['trajectory'])
export class PluginListingRow {
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

    @Column('bigint', {
        transformer: {
            to: (value: number): number => value,
            from: (value: string | number): number => Number(value)
        }
    })
    timestep!: number;

    @Column('jsonb', { default: () => '\'{}\'::jsonb' })
    row!: JsonObject;

    @Column('jsonb', { default: () => '\'[]\'::jsonb' })
    subListingNames!: string[];
}

export const buildPluginListingRowId = (
    analysis: string,
    exposureId: string,
    timestep: number
): string => `${analysis}:${exposureId}:${timestep}`;

export type PluginListingRowDocument = PluginListingRow;
