import GetGlobalSearchUseCase from '@modules/dashboard/application/use-cases/GetGlobalSearchUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

const GetGlobalSearchController = createController(GetGlobalSearchUseCase);

export default createControllerRegistry({
    getGlobalSearch: GetGlobalSearchController
});
