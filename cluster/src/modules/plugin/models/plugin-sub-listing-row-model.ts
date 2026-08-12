import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { JsonObject } from '@shared/contracts/types/json';

@Entity('plugin_sub_listing_rows')
@Index(['analysis', 'exposureId', 'timestep', 'subListingName'])
@Index(['analysis'])
export class PluginSubListingRow {
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

export const buildPluginSubListingRowId = (
    analysis: string,
    exposureId: string,
    timestep: number,
    subListingName: string,
    index: number
): string => `${analysis}:${exposureId}:${timestep}:${subListingName}:${index}`;

export type PluginSubListingRowDocument = PluginSubListingRow;
