import endpoints from './endpoints';
import { defineServiceModule } from '@/shared/api/service-module';

export default defineServiceModule({
    clients: {
        dashboard: {
            basePath: '/dashboard',
            useRBAC: true
        },
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
    },
    endpoints
});
