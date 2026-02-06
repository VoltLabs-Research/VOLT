import { container } from 'tsyringe';
import MetricsCollectorService from '@modules/system/infrastructure/services/MetricsCollectorService';

export const registerSystemDependencies = (): void => {
    container.registerSingleton('IMetricsService', MetricsCollectorService);
};
