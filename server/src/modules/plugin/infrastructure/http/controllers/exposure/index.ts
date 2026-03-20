import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureGLBUseCase';

import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

const GetPluginExposureGLBController = createPreparedDownloadStreamController(GetPluginExposureGLBUseCase);
const GetPluginExposureExportController = createPreparedDownloadStreamController(GetPluginExposureExportUseCase);

export default createControllerRegistry({
    getPluginExposureGLB: GetPluginExposureGLBController,
    getPluginExposureExport: GetPluginExposureExportController
});
