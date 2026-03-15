const { getRuntimeContext } = require('./runtime.cjs');

const DEFAULT_PASSWORD = 'VoltApiTests123!';

let bootstrapContextPromise;

const createRandomValue = (prefix) => {
    const timestamp = Date.now();
    const randomValue = Math.random().toString(36).slice(2, 10);
    return `${prefix}-${timestamp}-${randomValue}`;
};

const createUserPayload = (label) => {
    const suffix = createRandomValue(label);

    return {
        email: `${suffix}@example.test`,
        firstName: 'API',
        lastName: label,
        password: DEFAULT_PASSWORD
    };
};

const extractSuccessData = (response) => {
    return response.body && typeof response.body === 'object'
        ? response.body.data
        : undefined;
};

const signUpUser = async (requester, label) => {
    const payload = createUserPayload(label);
    const response = await requester
        .post('/api/auth/users')
        .send({
            ...payload,
            passwordConfirm: DEFAULT_PASSWORD
        })
        .expect(201);

    const data = extractSuccessData(response);

    return {
        payload,
        token: data.token,
        user: data.user
    };
};

const createTeam = async (requester, ownerToken) => {
    const response = await requester
        .post('/api/teams')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            name: createRandomValue('api-team'),
            description: 'Managed by API integration tests'
        })
        .expect(201);

    const data = extractSuccessData(response);

    return {
        team: data,
        teamId: data._id
    };
};

const createBootstrapContext = async () => {
    const runtimeContext = await getRuntimeContext();
    const owner = await signUpUser(runtimeContext.requester, 'owner');
    const outsider = await signUpUser(runtimeContext.requester, 'outsider');
    const teamContext = await createTeam(runtimeContext.requester, owner.token);

    return {
        ...runtimeContext,
        owner,
        outsider,
        ...teamContext
    };
};

const getBootstrapContext = async () => {
    if (!bootstrapContextPromise) {
        bootstrapContextPromise = createBootstrapContext();
    }

    return bootstrapContextPromise;
};

module.exports = {
    DEFAULT_PASSWORD,
    createUserPayload,
    extractSuccessData,
    getBootstrapContext
};
