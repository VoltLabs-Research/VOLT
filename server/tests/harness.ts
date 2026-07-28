import 'reflect-metadata';
import { BaseEntity, DataSource } from 'typeorm';
import type { EntitySchema, MixedList } from 'typeorm';

export type HarnessEntities = MixedList<string | Function | EntitySchema>;

export const createHarness = async (entities: HarnessEntities): Promise<DataSource> => {
    const dataSource = new DataSource({
        type: 'better-sqlite3',
        database: ':memory:',
        synchronize: true,
        entities
    });

    await dataSource.initialize();
    BaseEntity.useDataSource(dataSource);

    return dataSource;
};

export const destroyHarness = async (dataSource: DataSource): Promise<void> => {
    await dataSource.destroy();
    BaseEntity.useDataSource(null);
};
