import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { signTeamClusterDirectAccessToken, verifyTeamClusterDirectAccessToken } from '../src/contracts/directAccessToken';
import type { TeamClusterDirectAccessTokenClaims } from '../src/contracts/objectGateway';

const now = Math.floor(Date.now() / 1000);

const claims: TeamClusterDirectAccessTokenClaims = {
    requesterKind: 'server',
    requesterId: 'volt-server',
    ownerClusterId: 'cluster-1',
    teamId: 'team-1',
    exposureId: 'object-gateway',
    exposureName: 'Object gateway',
    accessMode: 'http',
    iat: now,
    exp: now + 60
};

describe('direct access token', () => {
    it('verifies a token signed with the same daemon password', async () => {
        const token = await signTeamClusterDirectAccessToken(claims, 'daemon-password');
        assert.deepEqual(await verifyTeamClusterDirectAccessToken(token, 'daemon-password'), claims);
    });

    it('rejects a token signed with another password', async () => {
        const token = await signTeamClusterDirectAccessToken(claims, 'daemon-password');
        assert.equal(await verifyTeamClusterDirectAccessToken(token, 'other-password'), null);
    });

    it('rejects an expired token', async () => {
        const token = await signTeamClusterDirectAccessToken({ ...claims, iat: now - 120, exp: now - 60 }, 'daemon-password');
        assert.equal(await verifyTeamClusterDirectAccessToken(token, 'daemon-password'), null);
    });
});
