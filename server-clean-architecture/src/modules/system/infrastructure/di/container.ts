import { container } from 'tsyringe';
import MetricsCollectorService from '../services/MetricsCollectorService';

export const registerSystemDependencies = (): void => {
    container.registerSingleton('IMetricsService', MetricsCollectorService);
};
