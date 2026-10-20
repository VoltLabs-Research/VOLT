import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import VoltClient from '../src/core/VoltClient';
import type { HttpClient, HttpRequest } from '../src/core/HttpClient';
import { createService, get, post } from '../src/dsl/create-service';

function echoFactory() {
    const requests: HttpRequest[] = [];
    const http: HttpClient = {
        request<T>(req: HttpRequest): Promise<T> {
            requests.push(req);
            return Promise.resolve({
                status: 'success',
                data: { url: req.url, body: req.body, query: req.query, method: req.method }
            } as T);
        }
    };
    const factory = (basePath: string, opts?: { useRBAC?: boolean; getTeamId?: () => string | null }) =>
        new VoltClient(http, basePath, opts);
    return { requests, factory };
}

describe('createService', () => {
    it('substitutes path params and routes the rest to the query on GET', async () => {
        const { factory } = echoFactory();
        const svc = createService('/users', { getById: get<{ id: string; q?: string }, any>('/:id') }, factory);
        const result = await svc.getById({ id: '5', q: 'x' });
        assert.equal(result.url, '/users/5');
        assert.deepEqual(result.query, { q: 'x' });
        assert.equal(result.method, 'GET');
    });

    it('routes the body on POST', async () => {
        const { factory } = echoFactory();
        const svc = createService('/users', { create: post<{ name: string }, any>('/') }, factory);
        const result = await svc.create({ name: 'ada' });
        assert.equal(result.url, '/users');
        assert.deepEqual(result.body, { name: 'ada' });
        assert.equal(result.method, 'POST');
    });

    it('applies a map transform to the unwrapped result', async () => {
        const { factory } = echoFactory();
        const svc = createService(
            '/users',
            { whichUrl: get<{ id: string }, string, { url: string }>('/:id', { map: (raw) => raw.url }) },
            factory
        );
        assert.equal(await svc.whichUrl({ id: '9' }), '/users/9');
    });

    it('throws when a required path param is missing', async () => {
        const { factory } = echoFactory();
        const svc = createService('/users', { getById: get<{ id?: string }, any>('/:id') }, factory);
        await assert.rejects(() => svc.getById({}), /Missing path param: id/);
    });
});
