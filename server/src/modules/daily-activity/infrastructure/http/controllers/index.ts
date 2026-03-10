import FindActivityByTeamIdController from './FindActivityByTeamIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    getByTeamId: FindActivityByTeamIdController
});