import assert from 'node:assert/strict';
import test from 'node:test';
import { PluginListingRowModel } from '../models/PluginListingRowModel';
import { MongoPluginListingRepository } from './PluginListingRepository';

test('MongoPluginListingRepository.importMongoRows rewrites payloadOwnerClusterId to the local owner cluster', async () => {
    const listingRowModel = PluginListingRowModel as any;
    const originalBulkWrite = listingRowModel.bulkWrite;
    const capturedOperations: Array<Record<string, unknown>> = [];

    listingRowModel.bulkWrite = async (operations: Array<Record<string, unknown>>) => {
        capturedOperations.push(...operations);
        return {} as any;
    };

    try {
        const repository = new MongoPluginListingRepository({} as never, 'destination-cluster');
        const importedRows = await repository.importMongoRows({
            analysisIds: ['analysis-1'],
            documentType: 'listing',
            rows: [
                {
                    _id: 'row-1',
                    analysis: 'analysis-1',
                    payloadObjectKey: 'plugins/trajectory-1/analysis-1/exposure-1/timestep-1.msgpack',
                    payloadOwnerClusterId: 'source-cluster'
                }
            ]
        });

        assert.equal(importedRows, 1);
        assert.equal(capturedOperations.length, 1);
        assert.equal(
            (capturedOperations[0].replaceOne as { replacement: { payloadOwnerClusterId: string; }; }).replacement.payloadOwnerClusterId,
            'destination-cluster'
        );
    } finally {
        listingRowModel.bulkWrite = originalBulkWrite;
    }
});
