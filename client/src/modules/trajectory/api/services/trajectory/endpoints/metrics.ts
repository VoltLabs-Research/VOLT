import { get } from '@/app/core/http/utilities/create-service';
import type { DashboardMetrics } from '@/modules/dashboard/api/entities/dashboard';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';

export default {
    getMetrics: get<EmptyParams, DashboardMetrics>('/metrics')
};
