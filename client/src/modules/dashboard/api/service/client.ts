const client = {
    analysis: {
        basePath: '/analyses',
        useRBAC: true
    },
    container: {
        basePath: '/containers',
        useRBAC: true
    },
    trajectory: {
        basePath: '/trajectories',
        useRBAC: true
    },
    team: {
        basePath: '/teams',
        useRBAC: false
    },
    teamCluster: {
        basePath: '/teams',
        useRBAC: false
    },
    plugin: {
        basePath: '/plugins',
        useRBAC: true
    },
    chat: {
        basePath: '/chats',
        useRBAC: false
    },
    metrics: {
        basePath: '/trajectories',
        useRBAC: true
    }
};

export default client;
