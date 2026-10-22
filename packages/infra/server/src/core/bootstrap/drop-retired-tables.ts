import type { DataSource } from 'typeorm';
import logger from '@shared/logger';

// Tables no entity maps any more. synchronize never drops a table, so their rows would outlive
// the feature that wrote them. Ordered so that a table goes before the tables it references.
const RETIRED_TABLES = ['ai_messages', 'ai_conversations'];

export const dropRetiredTables = async (dataSource: DataSource): Promise<void> => {
    const runner = dataSource.createQueryRunner();

    try{
        for(const table of RETIRED_TABLES){
            if(!await runner.hasTable(table)) continue;

            await runner.dropTable(table);
            logger.info(`@database: dropped retired table ${table}`);
        }
    }finally{
        await runner.release();
    }
};
