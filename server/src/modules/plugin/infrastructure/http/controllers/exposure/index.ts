import GetPluginExposureGLBController from './GetPluginExposureGLBController';
import { container } from 'tsyringe';

export default {
    getPluginExposureGLB: container.resolve(GetPluginExposureGLBController)
};