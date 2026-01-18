import GetRBACConfigController from './GetRBACConfigController';
import GetSystemStatsController from './GetSystemStatsController';
import { container } from 'tsyringe';

export default {
    getRbacConfig: container.resolve(GetRBACConfigController),
    getSystemStats: container.resolve(GetSystemStatsController)
};