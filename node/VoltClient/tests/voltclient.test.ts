import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import VoltClient from '../src/core/VoltClient';
import type { HttpClient, HttpRequest } from '../src/core/HttpClient';

/** Records every request and returns canned responses keyed by URL. */
class RecordingHttp implements HttpClient {
    public readonly requests: HttpRequest[] = [];
    constructor(private readonly responder: (req: HttpRequest) => unknown = () => ({})) {}
    request<T>(req: HttpRequest): Promise<T> {
        this.requests.push(req);
        return Promise.resolve(this.responder(req) as T);
    }
}

describe('VoltClient URL building', () => {
    it('joins base path and sub-path', async () => {
        const http = new RecordingHttp();
        const client = new VoltClient(http, '/trajectories');
        await client.get('/list');
        assert.equal(http.requests[0].url, '/trajectories/list');
    });

    it('injects the team id when RBAC is enabled', async () => {
        const http = new RecordingHttp();
        const client = new VoltClient(http, '/container', { useRBAC: true, getTeamId: () => 'team-1' });
        await client.get('/ps');
        assert.equal(http.requests[0].url, '/container/team-1/ps');
    });

    it('throws when RBAC is enabled without a team id', async () => {
        const client = new VoltClient(new RecordingHttp(), '/x', { useRBAC: true, getTeamId: () => null });
        await assert.rejects(() => client.get('/y'), /missing teamId/);
    });
});

describe('VoltClient envelope unwrapping', () => {
    it('getUnwrapped strips { status, data }', async () => {
        const http = new RecordingHttp(() => ({ status: 'success', data: { id: '1' } }));
        const client = new VoltClient(http, '');
        assert.deepEqual(await client.getUnwrapped('/x'), { id: '1' });
    });

    it('getPaginated normalizes the flat shape', async () => {
        const http = new RecordingHttp(() => ({
            status: 'success',
            data: [{ id: 'a' }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false }
        }));
        const client = new VoltClient(http, '');
        const page = await client.getPaginated('/list');
        assert.deepEqual(page.data, [{ id: 'a' }]);
        assert.equal(page.pagination.hasMore, false);
    });

    it('getPaginated normalizes the inline shape', async () => {
        const http = new RecordingHttp(() => ({
            status: 'success',
            data: { data: [{ id: 'b' }], total: 25, page: 1, totalPages: 3, limit: 10 }
        }));
        const client = new VoltClient(http, '');
        const page = await client.getPaginated('/list');
        assert.deepEqual(page.data, [{ id: 'b' }]);
        assert.equal(page.pagination.total, 25);
        assert.equal(page.pagination.hasMore, true);
    });
});

describe('VoltClient in-flight GET deduplication', () => {
    it('coalesces concurrent identical GETs regardless of query key order', async () => {
        let calls = 0;
        let release: (value: unknown) => void = () => {};
        const http: HttpClient = {
            request<T>(): Promise<T> {
                calls += 1;
                return new Promise<T>((resolve) => {
                    release = resolve as (v: unknown) => void;
                });
            }
        };
        const client = new VoltClient(http, '');
        const p1 = client.get('/x', { a: 1, b: 2 });
        const p2 = client.get('/x', { b: 2, a: 1 });
        release({ status: 'success' });
        await Promise.all([p1, p2]);
        assert.equal(calls, 1);
    });

    it('does not coalesce when dedupeGetRequests is false', async () => {
        let calls = 0;
        const http: HttpClient = {
            request<T>(): Promise<T> {
                calls += 1;
                return Promise.resolve({} as T);
            }
        };
        const client = new VoltClient(http, '', { dedupeGetRequests: false });
        await Promise.all([client.get('/x'), client.get('/x')]);
        assert.equal(calls, 2);
    });
});

describe('VoltClient exportFile', () => {
    it('requests a blob response', async () => {
        const http = new RecordingHttp();
        const client = new VoltClient(http, '');
        await client.exportFile('/download');
        assert.equal(http.requests[0].responseType, 'blob');
        assert.equal(http.requests[0].method, 'GET');
    });
});
