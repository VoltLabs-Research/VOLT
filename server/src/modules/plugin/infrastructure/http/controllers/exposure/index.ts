import GetPluginExposureChartController from './GetPluginExposureChartController';
import GetPluginExposureGLBController from './GetPluginExposureGLBController';
import { container } from 'tsyringe';

export default {
    getPluginExposureChart: container.resolve(GetPluginExposureChartController),
    getPluginExposureGLB: container.resolve(GetPluginExposureGLBController)
};