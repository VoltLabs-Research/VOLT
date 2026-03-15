const fs = require('node:fs');
const path = require('node:path');

const API_ENDPOINTS_FILE_PATH = path.resolve(__dirname, '../../../../../api-endpoints.txt');

const parseEndpointLine = (line) => {
    const match = line.match(/^(GET|POST|PATCH|DELETE|USE)\s+(.+?)\s+=>\s+(.+)$/);
    if (!match) {
        return null;
    }

    return {
        method: match[1],
        path: match[2].trim(),
        description: match[3].trim()
    };
};

const parseCatalog = () => {
    const fileContents = fs.readFileSync(API_ENDPOINTS_FILE_PATH, 'utf8');
    const lines = fileContents.split(/\r?\n/);
    const modules = [];
    let currentModule = null;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine === '----') {
            continue;
        }

        if (trimmedLine.startsWith('module: ')) {
            if (currentModule) {
                modules.push(currentModule);
            }

            currentModule = {
                name: trimmedLine.replace('module: ', '').trim(),
                basePath: '',
                endpoints: []
            };
            continue;
        }

        if (trimmedLine.startsWith('basePath: ')) {
            currentModule.basePath = trimmedLine.replace('basePath: ', '').trim();
            continue;
        }

        const endpoint = parseEndpointLine(trimmedLine);
        if (endpoint && currentModule) {
            currentModule.endpoints.push(endpoint);
        }
    }

    if (currentModule) {
        modules.push(currentModule);
    }

    return modules;
};

const PUBLIC_MODULES = new Set([
    'container-vnc-connect',
    'scripting-jupyter',
    'team-cluster-lifecycle'
]);

const isPublicAuthEndpoint = (endpointDefinition) => {
    const publicPaths = new Set([
        '/sessions',
        '/users',
        '/guest-identity',
        '/github',
        '/github/callback',
        '/google',
        '/google/callback',
        '/microsoft',
        '/microsoft/callback'
    ]);

    if (publicPaths.has(endpointDefinition.path)) {
        return true;
    }

    return endpointDefinition.path.startsWith('/emails/');
};

const isProtectedEndpoint = (moduleDefinition, endpointDefinition) => {
    if (moduleDefinition.name === 'auth') {
        return !isPublicAuthEndpoint(endpointDefinition);
    }

    return !PUBLIC_MODULES.has(moduleDefinition.name);
};

module.exports = {
    parseCatalog,
    isProtectedEndpoint
};
