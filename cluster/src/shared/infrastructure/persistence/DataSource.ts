import fs from 'node:fs/promises';
import path from 'node:path';
import { DataSource } from 'typeorm';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import { resolveDatabaseDialect, sqliteDatabasePath } from '@shared/infrastructure/persistence/dialect';

const SQLITE_IN_MEMORY_PATH = ':memory:';
const SQLITE_BUSY_TIMEOUT_MS = 10_000;

let dataSource: DataSource | null = null;

export const getDaemonDataSource = (): DataSource => {
    if (!dataSource) {
        throw new Error('The daemon data source was read before connectDaemonDataSource ran');
    }

    return dataSource;
};

const ensurePostgresDatabaseExists = async (url: string): Promise<void> => {
    const target = new URL(url);
    const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
    if (!databaseName) {
        throw new Error('DATABASE_URL must name a database');
    }

    const maintenanceUrl = new URL(url);
    maintenanceUrl.pathname = '/postgres';

    const admin = new DataSource({
        type: 'postgres',
        url: maintenanceUrl.toString(),
        applicationName: 'volt-cluster-daemon-bootstrap'
    });

    await admin.initialize();
    try {
        const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
        if (existing.length === 0) {
            await admin.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
            logger.info(`@daemon-datasource: created database ${databaseName}`);
        }
    } finally {
        await admin.destroy();
    }
};

const buildPostgresDataSource = (url: string, entities: Function[]): DataSource => new DataSource({
    type: 'postgres',
    url,
    synchronize: true,
    entities,
    applicationName: 'volt-cluster-daemon',
    poolSize: 10
});

const buildSqliteDataSource = (databasePath: string, entities: Function[]): DataSource => new DataSource({
    type: 'better-sqlite3',
    database: databasePath,
    synchronize: true,
    entities,
    timeout: SQLITE_BUSY_TIMEOUT_MS,
    prepareDatabase: (database: { pragma(source: string): unknown }) => {
        database.pragma('journal_mode = WAL');
        database.pragma('synchronous = NORMAL');
        database.pragma('foreign_keys = ON');
    }
});

export const connectDaemonDataSource = async (entities: Function[]): Promise<DataSource> => {
    if (dataSource?.isInitialized) {
        return dataSource;
    }

    const databaseUrl = getConfig().databaseUrl;
    const dialect = resolveDatabaseDialect(databaseUrl);

    if (dialect === 'sqlite') {
        const databasePath = sqliteDatabasePath(databaseUrl);
        if (databasePath !== SQLITE_IN_MEMORY_PATH) {
            await fs.mkdir(path.dirname(databasePath), { recursive: true });
        }
        dataSource = buildSqliteDataSource(databasePath, entities);
    } else {
        await ensurePostgresDatabaseExists(databaseUrl);
        dataSource = buildPostgresDataSource(databaseUrl, entities);
    }

    await dataSource.initialize();
    logger.info(`@daemon-datasource: connected (${dialect}) and schema synchronized`);
    return dataSource;
};

export const disconnectDaemonDataSource = async (): Promise<void> => {
    if (!dataSource?.isInitialized) {
        return;
    }

    await dataSource.destroy();
    dataSource = null;
};
