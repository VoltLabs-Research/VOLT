import GetRBACConfigController from './GetRBACConfigController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    getRbacConfig: GetRBACConfigController
});