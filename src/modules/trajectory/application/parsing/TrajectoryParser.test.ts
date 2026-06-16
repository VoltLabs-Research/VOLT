import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TrajectoryParser } from '@/modules/trajectory/application/parsing/TrajectoryParser';
import type {
    TrajectoryElementMetadata,
    TrajectoryFrameData,
    TrajectoryFrameStore
} from '@/modules/trajectory/application/storage/TrajectoryFrameStore';

const buildFrame = (): TrajectoryFrameData => ({
    timestep: 1000,
    atomCount: 4,
    positions: new Float32Array([0.1, 0.2, 0.3, 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3]),
    types: new Uint16Array([1, 1, 2, 2]),
    ids: new Uint32Array([1, 2, 3, 4]),
    properties: {
        mol: { dtype: 'i32', values: new Int32Array([1000003, 1000003, 7, 7]) },
        q: { dtype: 'f32', values: new Float32Array([0.5, -0.5, 1.25, 1.25]) },
        structuretype: { dtype: 'i32', values: new Int32Array([2, 2, 0, 1]) }
    },
    frameBbox: [0.1, 0.2, 0.3, 3.1, 3.2, 3.3]
});

const ELEMENT_METADATA: TrajectoryElementMetadata = {
    units: 'metal',
    elementTable: [
        { type: 1, symbol: 'Fe', displayName: 'Iron', color: [0.87, 0.4, 0.2], radius: 1.32, mass: 55.845, covalentRadius: 1.32, vdwRadius: 2, maxCoordination: 8 },
        { type: 2, symbol: 'C', displayName: 'Carbon', color: [0.56, 0.56, 0.56], radius: 0.76, mass: 12.011, covalentRadius: 0.76, vdwRadius: 1.7, maxCoordination: 4 }
    ]
};

const fakeFrameStore = (): TrajectoryFrameStore => {
    const frame = buildFrame();
    return {
        ingest: async () => { throw new Error('not used'); },
        readFrame: async () => frame,
        readElementMetadata: async () => ELEMENT_METADATA
    };
};

const input = { trajectoryId: 't1', ownerClusterId: 'c1', timestep: 1000 };

describe('TrajectoryParser typed-column contract', () => {
    it('getAtomsPage reports per-column dtype + element table + units', async () => {
        const parser = new TrajectoryParser(fakeFrameStore());
        const page = await parser.getAtomsPage({ ...input, page: 1, limit: 100 });

        assert.equal(page.propertyDtypes.mol, 'i32');
        assert.equal(page.propertyDtypes.structuretype, 'i32');
        assert.equal(page.propertyDtypes.q, 'f32');
        assert.equal(page.units, 'metal');
        assert.equal(page.elementTable[0].symbol, 'Fe');
        assert.equal(page.atoms[0].mol, 1000003);
        assert.equal(page.atoms[2].structuretype, 0);
    });

    it('getPropertyStats tags the dtype so the legend can pick int vs continuous', async () => {
        const parser = new TrajectoryParser(fakeFrameStore());
        const molStats = await parser.getPropertyStats({ ...input, property: 'mol' });
        const qStats = await parser.getPropertyStats({ ...input, property: 'q' });

        assert.equal(molStats.dtype, 'i32');
        assert.deepEqual([molStats.min, molStats.max], [7, 1000003]);
        assert.equal(qStats.dtype, 'f32');
    });

    it('getUniqueValues tags categorical int columns as discrete', async () => {
        const parser = new TrajectoryParser(fakeFrameStore());
        const unique = await parser.getUniqueValues({ ...input, property: 'structuretype', maxValues: 16 });

        assert.equal(unique.dtype, 'i32');
        assert.deepEqual(unique.values, [0, 1, 2]);
    });

    it('getTrajectoryMetadata surfaces units + element table', async () => {
        const parser = new TrajectoryParser(fakeFrameStore());
        const metadata = await parser.getTrajectoryMetadata(input);

        assert.equal(metadata.units, 'metal');
        assert.equal(metadata.elementTable.length, 2);
        assert.equal(metadata.elementTable[1].symbol, 'C');
        assert.deepEqual(metadata.headers, ['id', 'type', 'x', 'y', 'z', 'mol', 'q', 'structuretype']);
    });
});
