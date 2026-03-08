import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureGLBUseCase';

import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { container } from 'tsyringe';

const GetPluginExposureGLBController = createStreamController(GetPluginExposureGLBUseCase, {
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});
const GetPluginExposureExportController = createStreamController(GetPluginExposureExportUseCase, {
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});

export default {
    getPluginExposureGLB: container.resolve(GetPluginExposureGLBController),
    getPluginExposureExport: container.resolve(GetPluginExposureExportController)
};
