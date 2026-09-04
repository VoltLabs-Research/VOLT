import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BIG_INTEGER_COLUMN_TYPE, JSON_COLUMN_TYPE, jsonColumnDefault } from '@shared/infrastructure/persistence/column-types';
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

    @Column({
        type: BIG_INTEGER_COLUMN_TYPE,
        transformer: {
            to: (value: number): number => value,
            from: (value: string | number): number => Number(value)
        }
    })
    timestep!: number;

    @Column({
        type: JSON_COLUMN_TYPE,
        default: jsonColumnDefault('{}')
    })
    row!: JsonObject;

    @Column({
        type: JSON_COLUMN_TYPE,
        default: jsonColumnDefault('[]')
    })
    subListingNames!: string[];
}

export const buildPluginListingRowId = (
    analysis: string,
    exposureId: string,
    timestep: number
): string => `${analysis}:${exposureId}:${timestep}`;

export type PluginListingRowDocument = PluginListingRow;
