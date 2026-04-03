import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import WhiteboardRealtimeStateService from './WhiteboardRealtimeStateService';

import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

class StubWhiteboardRepository {
    public lastEditedBy: string | null = null;

    async findById(id: string): Promise<Whiteboard | null> {
        return {
            _id: id,
            props: {
                team: 'team-1',
                createdBy: 'user-1',
                title: 'Board',
                folder: null,
                payloadKey: 'team-1/board-1/state.json',
                createdAt: new Date(),
                updatedAt: new Date(),
                lastEditedBy: this.lastEditedBy
            }
        } as Whiteboard;
    }

    async updateById(_id: string, data: Partial<Whiteboard['props']>): Promise<Whiteboard | null> {
        this.lastEditedBy = typeof data.lastEditedBy === 'string' ? data.lastEditedBy : null;
        return this.findById('board-1');
    }

    async findOne(): Promise<Whiteboard | null> { return null; }
    async findAll(): Promise<never> { throw new Error('not implemented'); }
    async export(): Promise<Whiteboard[]> { return []; }
    async create(): Promise<Whiteboard> { throw new Error('not implemented'); }
    async updateMany(): Promise<number> { return 0; }
    async insertMany(): Promise<void> {}
    async deleteById(): Promise<boolean> { return false; }
    async deleteMany(): Promise<number> { return 0; }
    async count(): Promise<number> { return 0; }
    async countGroupedBy(): Promise<Map<string, number>> { return new Map(); }
    async exists(): Promise<boolean> { return true; }
    async findByTeamAndWhiteboardId(): Promise<Whiteboard | null> { return this.findById('board-1'); }
    async findAllByTeam(): Promise<never> { throw new Error('not implemented'); }
}

class StubStorageService {
    public uploads: string[] = [];

    async upload(_bucket: string, _objectName: string, source: string | Buffer): Promise<void> {
        this.uploads.push(typeof source === 'string' ? source : source.toString('utf8'));
    }

    async exists(): Promise<boolean> { return true; }
    async getBuffer(): Promise<Buffer> {
        return Buffer.from(JSON.stringify({ revision: 0, elements: [], appState: {} }));
    }

    async listByPrefix(): Promise<AsyncIterable<string>> { throw new Error('not implemented'); }
    async getStream(): Promise<never> { throw new Error('not implemented'); }
    async delete(): Promise<void> {}
    async deleteByPrefix(): Promise<void> {}
    getPublicURL(): string { return ''; }
    async getStat(): Promise<never> { throw new Error('not implemented'); }
    async download(): Promise<void> {}
}

const buildService = () => {
    const repository = new StubWhiteboardRepository();
    const storage = new StubStorageService();

    return {
        repository,
        storage,
        service: new WhiteboardRealtimeStateService(
            repository as unknown as IWhiteboardRepository,
            storage as unknown as IStorageService
        )
    };
};

test('WhiteboardRealtimeStateService merges concurrent element snapshots without dropping peers', async () => {
    const { service } = buildService();

    await service.mergeScene('board-1', [{ id: 'x', version: 1, updated: 10 }], { viewBackgroundColor: '#fff' }, 'user-a');
    const mergeResult = await service.mergeScene('board-1', [{ id: 'y', version: 1, updated: 11 }], { gridSize: 16 }, 'user-b');
    const snapshot = await service.getSnapshot('board-1');

    assert.equal(mergeResult?.changed, true);
    assert.deepEqual(mergeResult?.delta?.elements.map((element) => element.id), ['y']);
    assert.deepEqual(mergeResult?.delta?.appState, { gridSize: 16 });
    assert.ok(snapshot);
    assert.equal(snapshot?.revision, 2);
    assert.deepEqual(snapshot?.elements.map((element) => element.id), ['x', 'y']);
    assert.deepEqual(snapshot?.appState, {
        viewBackgroundColor: '#fff',
        gridSize: 16
    });
});

test('WhiteboardRealtimeStateService keeps the newest element revision during merges', async () => {
    const { service } = buildService();

    await service.mergeScene('board-1', [{ id: 'shape-1', version: 3, updated: 30, x: 40 }], {}, 'user-a');
    const mergeResult = await service.mergeScene('board-1', [{ id: 'shape-1', version: 2, updated: 20, x: 10 }], {}, 'user-b');
    const snapshot = await service.getSnapshot('board-1');

    assert.equal(mergeResult?.changed, false);
    assert.equal(mergeResult?.revision, 1);
    assert.ok(snapshot);
    assert.equal(snapshot?.elements[0]?.x, 40);
    assert.equal(snapshot?.elements[0]?.version, 3);
});

test('WhiteboardRealtimeStateService preserves fileId updates even when element version metadata is unchanged', async () => {
    const { service } = buildService();

    await service.mergeScene('board-1', [{ id: 'image-1', type: 'image', version: 1, updated: 10 }], {}, 'user-a');
    const mergeResult = await service.mergeScene('board-1', [{ id: 'image-1', type: 'image', version: 1, updated: 10, fileId: 'asset-1' }], {}, 'user-a');
    const snapshot = await service.getSnapshot('board-1');

    assert.equal(mergeResult?.changed, true);
    assert.equal(mergeResult?.delta?.elements[0]?.fileId, 'asset-1');
    assert.ok(snapshot);
    assert.equal(snapshot?.elements[0]?.fileId, 'asset-1');
});

test('WhiteboardRealtimeStateService only broadcasts full element order when z-order changes explicitly', async () => {
    const { service } = buildService();

    await service.mergeScene('board-1', [{ id: 'x', version: 1, updated: 10 }], {}, 'user-a');
    await service.mergeScene('board-1', [{ id: 'y', version: 1, updated: 11 }], {}, 'user-a');

    const mergeResult = await service.mergeScene('board-1', [], {}, 'user-a', ['y', 'x']);
    const snapshot = await service.getSnapshot('board-1');

    assert.equal(mergeResult?.changed, true);
    assert.deepEqual(mergeResult?.delta?.elementOrder, ['y', 'x']);
    assert.deepEqual(snapshot?.elements.map((element) => element.id), ['y', 'x']);
});
