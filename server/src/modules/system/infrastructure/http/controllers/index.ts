import GetRBACConfigController from './GetRBACConfigController';
import GetSystemStatsController from './GetSystemStatsController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    getRbacConfig: GetRBACConfigController,
    getSystemStats: GetSystemStatsController
});