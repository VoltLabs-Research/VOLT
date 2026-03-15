const { getBootstrapContext } = require('../setup/bootstrap.cjs');
const { parseCatalog, isProtectedEndpoint } = require('../setup/catalog.cjs');
const { buildRequest } = require('../setup/request.cjs');

const API_MODULES = parseCatalog();

const buildPublicExpectation = (moduleDefinition, endpointDefinition) => {
    if (moduleDefinition.name === 'auth') {
        if (endpointDefinition.path === '/guest-identity') {
            return {
                expectedStatuses: [200],
                query: { seed: 'catalog-contract-seed' }
            };
        }

        if (endpointDefinition.path.startsWith('/emails/')) {
            return {
                expectedStatuses: [200]
            };
        }

        if (endpointDefinition.path === '/users' || endpointDefinition.path === '/sessions') {
            return {
                expectedStatuses: [400],
                body: {}
            };
        }

        if (endpointDefinition.path.endsWith('/callback')) {
            return {
                expectedStatuses: [400, 500]
            };
        }

        return {
            expectedStatuses: [302, 500]
        };
    }

    if (moduleDefinition.name === 'container-vnc-connect') {
        if (endpointDefinition.path === '/connect-client.js') {
            return {
                expectedStatuses: [200]
            };
        }

        if (endpointDefinition.method === 'USE') {
            return {
                expectedStatuses: [200]
            };
        }

        return {
            expectedStatuses: [200, 400, 404, 500],
            query: {
                token: 'bootstrap-test-token',
                parentOrigin: 'http://localhost:3000'
            }
        };
    }

    if (moduleDefinition.name === 'team-cluster-lifecycle') {
        return {
            expectedStatuses: [400],
            body: {}
        };
    }

    if (moduleDefinition.name === 'scripting-jupyter') {
        return {
            expectedStatuses: [400, 401, 403, 404, 500, 502, 504]
        };
    }

    return {
        expectedStatuses: [200, 201, 204, 400, 401, 403, 404, 409, 500]
    };
};

describe('documented API endpoint contracts', () => {
    beforeAll(async () => {
        await getBootstrapContext();
    });

    describe.each(API_MODULES)('%s', (moduleDefinition) => {
        test.each(moduleDefinition.endpoints.map((endpointDefinition) => [endpointDefinition]))(
            '%s %s',
            async (endpointDefinition) => {
                if (isProtectedEndpoint(moduleDefinition, endpointDefinition)) {
                    const { request } = await buildRequest(moduleDefinition, endpointDefinition);
                    const response = await request;

                    expect(response.statusCode).toBe(401);
                    return;
                }

                const expectation = buildPublicExpectation(moduleDefinition, endpointDefinition);
                const { request } = await buildRequest(moduleDefinition, endpointDefinition, {
                    body: expectation.body,
                    query: expectation.query,
                    includeBootstrapContext: moduleDefinition.basePath.includes(':teamId')
                });
                const response = await request;

                expect(expectation.expectedStatuses).toContain(response.statusCode);
            }
        );
    });
});
