import { DataSource } from 'typeorm';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';

let dataSource: DataSource | null = null;

export const getDaemonDataSource = (): DataSource => {
    if (!dataSource) {
        throw new Error('The daemon data source was read before connectDaemonDataSource ran');
    }

    return dataSource;
};

const ensureDatabaseExists = async (url: string): Promise<void> => {
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

export const connectDaemonDataSource = async (entities: Function[]): Promise<DataSource> => {
    if (dataSource?.isInitialized) {
        return dataSource;
    }

    dataSource = new DataSource({
        type: 'postgres',
        url: getConfig().databaseUrl,
        synchronize: true,
        entities,
        applicationName: 'volt-cluster-daemon',
        poolSize: 10
    });

    await ensureDatabaseExists(getConfig().databaseUrl);
    await dataSource.initialize();
    logger.info('@daemon-datasource: connected and schema synchronized');
    return dataSource;
};

export const disconnectDaemonDataSource = async (): Promise<void> => {
    if (!dataSource?.isInitialized) {
        return;
    }

    await dataSource.destroy();
    dataSource = null;
};
