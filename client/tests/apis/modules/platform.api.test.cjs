const { extractSuccessData, getBootstrapContext } = require('../setup/bootstrap.cjs');

describe('platform API bootstrap', () => {
    test('creates a reusable authenticated owner and team', async () => {
        const context = await getBootstrapContext();

        expect(context.owner.token).toEqual(expect.any(String));
        expect(context.outsider.token).toEqual(expect.any(String));
        expect(context.teamId).toEqual(expect.any(String));
    });

    test('lists teams for the authenticated bootstrap owner', async () => {
        const context = await getBootstrapContext();
        const response = await context.requester
            .get('/api/teams')
            .set('Authorization', `Bearer ${context.owner.token}`)
            .expect(200);

        const teams = extractSuccessData(response);

        expect(Array.isArray(teams)).toBe(true);
        expect(teams.some((team) => team._id === context.teamId)).toBe(true);
    });

    test('returns team permissions for a valid team member', async () => {
        const context = await getBootstrapContext();
        const response = await context.requester
            .get(`/api/teams/${context.teamId}/self/permissions`)
            .set('Authorization', `Bearer ${context.owner.token}`)
            .expect(200);

        const permissions = extractSuccessData(response);

        expect(Array.isArray(permissions)).toBe(true);
    });

    test('forbids access to team-scoped permissions for non-members', async () => {
        const context = await getBootstrapContext();

        await context.requester
            .get(`/api/teams/${context.teamId}/self/permissions`)
            .set('Authorization', `Bearer ${context.outsider.token}`)
            .expect(403);
    });

    test('exposes critical authenticated platform endpoints', async () => {
        const context = await getBootstrapContext();

        const systemStatsResponse = await context.requester
            .get('/api/system/stats')
            .set('Authorization', `Bearer ${context.owner.token}`)
            .expect(200);

        expect(systemStatsResponse.body.status).toBe('success');

        const rbacResponse = await context.requester
            .get('/api/system/rbac')
            .set('Authorization', `Bearer ${context.owner.token}`)
            .expect(200);

        expect(rbacResponse.body.status).toBe('success');

        const sessionsResponse = await context.requester
            .get('/api/sessions')
            .set('Authorization', `Bearer ${context.owner.token}`)
            .expect(200);

        expect(sessionsResponse.body.status).toBe('success');

        const notificationsResponse = await context.requester
            .get('/api/notifications')
            .set('Authorization', `Bearer ${context.owner.token}`)
            .expect(200);

        expect(notificationsResponse.body.status).toBe('success');
    });
});
