const { createUserPayload, DEFAULT_PASSWORD, extractSuccessData } = require('../setup/bootstrap.cjs');
const { getRuntimeContext } = require('../setup/runtime.cjs');

describe('auth API', () => {
    test('checks email availability, signs up and signs in a user', async () => {
        const runtimeContext = await getRuntimeContext();
        const payload = createUserPayload('auth-flow');

        const availabilityBefore = await runtimeContext.requester
            .get(`/api/auth/emails/${encodeURIComponent(payload.email)}/availability`)
            .expect(200);

        expect(availabilityBefore.body.status).toBe('success');

        const signUpResponse = await runtimeContext.requester
            .post('/api/auth/users')
            .send(payload)
            .expect(400);

        expect(signUpResponse.body.code).toBe('Validation::InvalidInput');
        expect(signUpResponse.body.message).toContain('passwordConfirm');

        const signUpWithConfirmationResponse = await runtimeContext.requester
            .post('/api/auth/users')
            .send({
                ...payload,
                passwordConfirm: DEFAULT_PASSWORD
            })
            .expect(201);

        const signUpData = extractSuccessData(signUpWithConfirmationResponse);

        expect(signUpData.token).toEqual(expect.any(String));
        expect(signUpData.user.email).toBe(payload.email.toLowerCase());

        const availabilityAfter = await runtimeContext.requester
            .get(`/api/auth/emails/${encodeURIComponent(payload.email)}/availability`)
            .expect(200);

        expect(availabilityAfter.body.status).toBe('success');

        const signInResponse = await runtimeContext.requester
            .post('/api/auth/sessions')
            .send({
                email: payload.email,
                password: DEFAULT_PASSWORD
            })
            .expect(200);

        const signInData = extractSuccessData(signInResponse);

        expect(signInData.token).toEqual(expect.any(String));
        expect(signInData.user.email).toBe(payload.email.toLowerCase());

        const meResponse = await runtimeContext.requester
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${signInData.token}`)
            .expect(200);

        const meData = extractSuccessData(meResponse);

        expect(meData.email).toBe(payload.email.toLowerCase());
    });

    test('returns a guest identity for a valid seed', async () => {
        const runtimeContext = await getRuntimeContext();
        const response = await runtimeContext.requester
            .get('/api/auth/guest-identity')
            .query({ seed: 'auth-api-test-seed' })
            .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.data).toEqual(expect.any(Object));
    });

    test('rejects protected account endpoints without authentication', async () => {
        const runtimeContext = await getRuntimeContext();

        await runtimeContext.requester
            .get('/api/auth/me')
            .expect(401);

        await runtimeContext.requester
            .get('/api/auth/password/info')
            .expect(401);
    });
});
