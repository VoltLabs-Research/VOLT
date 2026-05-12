import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import { GetPluginExposureChartUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureChartUseCase';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureGLBUseCase';

import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

const GetPluginExposureGLBController = createPreparedDownloadStreamController(GetPluginExposureGLBUseCase);
const GetPluginExposureExportController = createPreparedDownloadStreamController(GetPluginExposureExportUseCase);
const GetPluginExposureChartController = createPreparedDownloadStreamController(GetPluginExposureChartUseCase);

export default createControllerRegistry({
    getPluginExposureGLB: GetPluginExposureGLBController,
    getPluginExposureExport: GetPluginExposureExportController,
    getPluginExposureChart: GetPluginExposureChartController
});
