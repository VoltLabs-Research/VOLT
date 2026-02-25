import GetPluginExposureGLBController from './GetPluginExposureGLBController';
import GetPluginExposureExportController from './GetPluginExposureExportController';
import { container } from 'tsyringe';

export default {
    getPluginExposureGLB: container.resolve(GetPluginExposureGLBController),
    getPluginExposureExport: container.resolve(GetPluginExposureExportController)
};
