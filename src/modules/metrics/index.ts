import { MetricsService } from './services';

interface MetricsModule {
    metricsService: MetricsService;
}

export const createMetricsModule = (): MetricsModule => ({
    metricsService: new MetricsService()
});

export { MetricsService } from './services';
