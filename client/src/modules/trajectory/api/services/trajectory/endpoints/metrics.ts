import { get, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { DashboardMetrics } from '@/modules/dashboard/api/entities/dashboard';

const endpoints = {
    getMetrics: get<EmptyParams, DashboardMetrics>('/metrics')
};

export default endpoints;
