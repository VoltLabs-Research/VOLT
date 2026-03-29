import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildJupyterProxyAccessCookieOptions,
    buildJupyterProxyUrl
} from './jupyter-proxy';
import type { Request } from 'express';

test('buildJupyterProxyUrl returns a clean proxy URL without browser access token query params', () => {
    const originalServerEndpoint = process.env.SERVER_ENDPOINT;
    process.env.SERVER_ENDPOINT = 'https://volt.example.com';

    try {
        const url = buildJupyterProxyUrl({
            teamId: 'team-1',
            runtimeNotebookId: 'runtime-1',
            notebookPath: 'folder/my notebook.ipynb'
        });

        assert.equal(
            url,
            'https://volt.example.com/api/jupyter/team-1/notebooks/runtime-1/lab/tree/folder/my%20notebook.ipynb'
        );
        assert.equal(new URL(url).searchParams.has('access_token'), false);
    } finally {
        if (originalServerEndpoint === undefined) {
            delete process.env.SERVER_ENDPOINT;
        } else {
            process.env.SERVER_ENDPOINT = originalServerEndpoint;
        }
    }
});

test('buildJupyterProxyAccessCookieOptions scopes the cookie to the notebook proxy path and honors forwarded https', () => {
    const req = {
        secure: false,
        headers: {
            'x-forwarded-proto': 'https'
        }
    } as unknown as Request;

    const options = buildJupyterProxyAccessCookieOptions(req, 'team-1', 'runtime-1', 123_000);

    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.secure, true);
    assert.equal(options.maxAge, 123_000);
    assert.equal(options.path, '/api/jupyter/team-1/notebooks/runtime-1');
});
