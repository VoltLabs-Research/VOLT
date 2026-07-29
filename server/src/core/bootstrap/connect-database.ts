import { BaseEntity } from 'typeorm';
import type { DataSource } from 'typeorm';
import { createDataSource } from '@core/config/database';
import { getEntities } from '@core/bootstrap/entities';
import logger from '@shared/infrastructure/logger';

let dataSource: DataSource | null = null;
export const connectDatabase = async (): Promise<void> => {
    if(dataSource?.isInitialized) return;

    logger.info('Connecting to the database...');

    dataSource = createDataSource(getEntities());
    await dataSource.initialize();
    BaseEntity.useDataSource(dataSource);

    logger.info(`Connected to the database (${dataSource.options.type})!`);
};

export const disconnectDatabase = async (): Promise<void> => {
    if(!dataSource?.isInitialized) return;

    await dataSource.destroy();
    BaseEntity.useDataSource(null);
    dataSource = null;
};
