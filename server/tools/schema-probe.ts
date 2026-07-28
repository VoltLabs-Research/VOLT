import 'reflect-metadata';
import { connectDatabase, disconnectDatabase, getDataSource } from '@core/bootstrap/connect-database';

const run = async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

    await connectDatabase();
    const dataSource = getDataSource();

    for(const metadata of dataSource.entityMetadatas){
        const columns = metadata.columns.map((column) => `${column.propertyName}->${column.databaseName}:${column.type}`);
        console.log(`\n[${metadata.name}] table=${metadata.tableName}`);
        console.log(`  columns: ${columns.join(', ')}`);
        console.log(`  relations: ${metadata.relations.map((relation) => `${relation.propertyName}(${relation.joinColumns.map((column) => column.databaseName).join(',')})`).join(', ') || 'none'}`);
        console.log(`  indices: ${metadata.indices.map((index) => `${index.columns.map((column) => column.databaseName).join('+')}${index.isUnique ? ' UNIQUE' : ''}${index.where ? ` WHERE ${index.where}` : ''}`).join(' | ') || 'none'}`);
    }

    await disconnectDatabase();
    console.log('\nschema probe OK');
};

run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
});
