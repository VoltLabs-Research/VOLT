const { getBootstrapContext } = require('./bootstrap.cjs');
const { getRuntimeContext } = require('./runtime.cjs');

const OBJECT_ID = '507f1f77bcf86cd799439011';

const PARAM_VALUE_MAP = {
    analysisId: '507f1f77bcf86cd799439012',
    assetId: '507f1f77bcf86cd799439013',
    chatId: '507f1f77bcf86cd799439014',
    containerId: '507f1f77bcf86cd799439015',
    conversationId: '507f1f77bcf86cd799439016',
    documentId: '507f1f77bcf86cd799439017',
    exposureId: '507f1f77bcf86cd799439018',
    fileId: '507f1f77bcf86cd799439019',
    folderId: '507f1f77bcf86cd799439020',
    invitationId: '507f1f77bcf86cd799439021',
    memberId: '507f1f77bcf86cd799439022',
    messageId: '507f1f77bcf86cd799439023',
    notebookId: '507f1f77bcf86cd799439024',
    pluginId: '507f1f77bcf86cd799439025',
    roleId: '507f1f77bcf86cd799439026',
    runtimeNotebookId: '507f1f77bcf86cd799439027',
    secretKeyId: '507f1f77bcf86cd799439028',
    sessionId: '507f1f77bcf86cd799439029',
    simulationCellId: '507f1f77bcf86cd799439030',
    sshConnectionId: '507f1f77bcf86cd799439031',
    targetUserId: '507f1f77bcf86cd799439032',
    teamClusterId: '507f1f77bcf86cd799439033',
    teamId: '507f1f77bcf86cd799439034',
    teamMemberId: '507f1f77bcf86cd799439035',
    trajectoryId: '507f1f77bcf86cd799439036'
};

const joinApiPath = (basePath, endpointPath) => {
    if (!endpointPath || endpointPath === '/') {
        return basePath;
    }

    return `${basePath.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
};

const resolveParamValue = (paramName, context) => {
    if (paramName === 'teamId' && context && context.teamId) {
        return context.teamId;
    }

    if (paramName === 'email') {
        return 'contract.user%40example.test';
    }

    if (paramName === 'provider') {
        return 'openai';
    }

    if (paramName === 'filename') {
        return 'sample.lammpstrj';
    }

    if (paramName === 'timestep') {
        return '0';
    }

    if (paramName === 'model') {
        return 'default';
    }

    return PARAM_VALUE_MAP[paramName] || OBJECT_ID;
};

const resolveEndpointPath = (moduleDefinition, endpointDefinition, context) => {
    if (moduleDefinition.name === 'container-vnc-connect' && endpointDefinition.method === 'USE') {
        return '/api/container-vnc/novnc/vnc.html';
    }

    if (moduleDefinition.name === 'scripting-jupyter' && endpointDefinition.method === 'USE') {
        const teamId = resolveParamValue('teamId', context);
        const runtimeNotebookId = resolveParamValue('runtimeNotebookId', context);
        return `/api/jupyter/${teamId}/notebooks/${runtimeNotebookId}`;
    }

    const template = joinApiPath(moduleDefinition.basePath, endpointDefinition.path);

    return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_match, paramName) => {
        return resolveParamValue(paramName, context);
    });
};

const getHttpMethod = (method) => {
    if (method === 'USE') {
        return 'get';
    }

    return method.toLowerCase();
};

const buildRequest = async (moduleDefinition, endpointDefinition, options = {}) => {
    const runtimeContext = await getRuntimeContext();
    const bootstrapContext = options.includeBootstrapContext
        ? await getBootstrapContext()
        : null;
    const context = bootstrapContext || runtimeContext;
    const path = resolveEndpointPath(moduleDefinition, endpointDefinition, context);
    const method = getHttpMethod(endpointDefinition.method);
    const request = runtimeContext.requester[method](path).timeout({
        response: runtimeContext.requestTimeoutMs,
        deadline: runtimeContext.requestTimeoutMs
    });

    if (options.token) {
        request.set('Authorization', `Bearer ${options.token}`);
    }

    if (options.query) {
        request.query(options.query);
    }

    if (options.body) {
        request.send(options.body);
    }

    return {
        path,
        request
    };
};

module.exports = {
    OBJECT_ID,
    buildRequest,
    resolveEndpointPath
};
