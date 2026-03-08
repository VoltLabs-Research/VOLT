import { get } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { DashboardMetrics } from '../../entities/dashboard';

export default {
    getMetrics: get<EmptyParams, DashboardMetrics>('/metrics', {
        client: 'metrics'
    })
};
