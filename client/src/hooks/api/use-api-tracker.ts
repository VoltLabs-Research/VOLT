import { useState, useEffect } from 'react';
import apiTrackerApi from '@/features/api-tracker/api/api-tracker';
import type { ApiTrackerRequest } from '@/features/api-tracker/types/types';

export type { ApiTrackerRequest };

export interface ApiTrackerResponse {
    status: 'success' | 'error';
    results: number;
    data: {
        requests: ApiTrackerRequest[];
        summary: any;
        statusCodeStats: any[];
        methodStats: any[];
    };
}

export interface UseApiTrackerOptions {
    limit?: number;
    page?: number;
    sort?: string;
    method?: string;
    statusCode?: number;
}

export const useApiTracker = (options: UseApiTrackerOptions = {}) => {
    const [data, setData] = useState<ApiTrackerResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchApiTracker = async () => {
        try {
            setLoading(true);
            setError(null);

            const requests = await apiTrackerApi.getAll({
                limit: options.limit,
                page: options.page,
                sort: options.sort,
                method: options.method,
                statusCode: options.statusCode
            });

            setData({
                status: 'success',
                results: requests?.length ?? 0,
                data: { requests, summary: null as any, statusCodeStats: [], methodStats: [] }
            });
        } catch (err: any) {
            console.error('❌ API tracker error:', err);
            console.error('❌ Error response:', err.response?.data);
            setError(err.response?.data?.message || err.message || 'Failed to fetch API tracker data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApiTracker();
    }, [options.limit, options.page, options.sort, options.method, options.statusCode]);

    return {
        data,
        loading,
        error,
        refetch: fetchApiTracker
    };
};

export default useApiTracker;
