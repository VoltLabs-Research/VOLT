import { DataSource } from 'typeorm';
import { getConfig } from '@core/config/daemon';
import { PluginListingRow } from '@modules/plugin/models/plugin-listing-row-model';
import { PluginSubListingRow } from '@modules/plugin/models/plugin-sub-listing-row-model';
import { QueueJob } from '@shared/infrastructure/queues/queue-job-model';
import { DaemonStateEntry, DaemonStateListItem } from '@shared/infrastructure/persistence/daemon-state-model';
import { logger } from '@shared/infrastructure/logger';
import { singleton } from '@shared/application/utilities/singleton';

const ENTITIES = [PluginListingRow, PluginSubListingRow, QueueJob, DaemonStateEntry, DaemonStateListItem];

/**
 * The daemon's relational store.
 *
 * `synchronize` is on regardless of environment, which is not the posture a
 * control-plane database would take. It is defensible here because both tables hold
 * strictly derived data: every row is reproducible by re-running the analysis that
 * emitted it, so schema drift costs recomputation rather than user data. If either
 * table ever holds something authored rather than computed, this needs migrations
 * first.
 */
export const getDaemonDataSource = singleton((): DataSource => new DataSource({
    type: 'postgres',
    url: getConfig().databaseUrl,
    synchronize: true,
    entities: ENTITIES,
    applicationName: 'volt-cluster-daemon',
    /*
     * Listing writes arrive in batches from the result processor rather than from
     * concurrent requests, so a wide pool buys nothing and only competes with the
     * control plane for connections on a single-node deployment.
     */
    poolSize: 10
}));

/**
 * Creates the daemon's database when it is missing.
 *
 * `synchronize` builds tables but never the database that holds them, and the
 * Postgres image only runs init scripts on a first-ever boot — so an existing
 * deployment adopting this would come up to a database that is simply not there.
 * Doing it here means one less thing a deployment has to have been set up correctly,
 * which matters most for the packaged single-machine install.
 */
const ensureDatabaseExists = async (url: string): Promise<void> => {
    const target = new URL(url);
    const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
    if (!databaseName) {
        throw new Error('DATABASE_URL must name a database');
    }

    /* `postgres` is the maintenance database every server is guaranteed to have. */
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
            /*
             * CREATE DATABASE takes no parameters, so the name is quoted rather than
             * bound. It comes from our own deployment config, and the quoting keeps a
             * name with unusual characters from changing the statement's shape.
             */
            await admin.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
            logger.info(`@daemon-datasource: created database ${databaseName}`);
        }
    } finally {
        await admin.destroy();
    }
};

export const connectDaemonDataSource = async (): Promise<DataSource> => {
    const dataSource = getDaemonDataSource();
    if (dataSource.isInitialized) {
        return dataSource;
    }

    await ensureDatabaseExists(getConfig().databaseUrl);
    await dataSource.initialize();
    logger.info('@daemon-datasource: connected and schema synchronized');
    return dataSource;
};

export const disconnectDaemonDataSource = async (): Promise<void> => {
    const dataSource = getDaemonDataSource();
    if (!dataSource.isInitialized) {
        return;
    }

    await dataSource.destroy();
};
