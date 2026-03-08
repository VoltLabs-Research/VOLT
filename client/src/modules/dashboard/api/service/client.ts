const client = {
    analysis: {
        basePath: '/analysis-config',
        useRBAC: true
    },
    container: {
        basePath: '/containers',
        useRBAC: true
    },
    trajectory: {
        basePath: '/trajectory',
        useRBAC: true
    },
    team: {
        basePath: '/teams',
        useRBAC: false
    },
    plugin: {
        basePath: '/plugins',
        useRBAC: true
    },
    chat: {
        basePath: '/chats',
        useRBAC: true
    },
    metrics: {
        basePath: '/trajectory',
        useRBAC: true
    }
};

export default client;
