import { DataSource } from 'typeorm';
import type { DataSourceOptions, EntitySchema, MixedList } from 'typeorm';
import { SQLITE_URL_SCHEME, resolveDatabaseDialect } from '@shared/infrastructure/persistence/dialect';

export type DatabaseEntities = MixedList<string | Function | EntitySchema>;

const getDatabaseUrl = (): string => {
    const url = process.env.DATABASE_URL;
    if(!url){
        throw new Error('DATABASE_URL environment variable is required');
    }

    return url;
};

const shouldSynchronize = (): boolean => process.env.NODE_ENV !== 'production';

const buildOptions = (url: string, entities: DatabaseEntities): DataSourceOptions => {
    if(resolveDatabaseDialect(url) === 'sqlite'){
        return {
            type: 'better-sqlite3',
            database: url.slice(SQLITE_URL_SCHEME.length),
            synchronize: true,
            entities
        };
    }

    return {
        type: 'postgres',
        url,
        synchronize: shouldSynchronize(),
        entities,
        applicationName: 'volt',
        poolSize: 100
    };
};

export const createDataSource = (entities: DatabaseEntities): DataSource => new DataSource(buildOptions(getDatabaseUrl(), entities));
