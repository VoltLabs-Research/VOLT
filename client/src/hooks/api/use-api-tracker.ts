/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useState, useEffect } from 'react';
import { api } from '@/api';

export interface ApiTrackerRequest {
    _id: string;
    method: string;
    url: string;
    userAgent?: string;
    ip: string;
    statusCode: number;
    responseTime: number;
    createdAt: string;
}

export interface ApiTrackerResponse {
    status: 'success' | 'error';
    results: number;
    data: {
        requests: ApiTrackerRequest[];
        summary: {
            totalRequests: number;
            averageResponseTime: number;
            uniqueIPsCount: number;
        };
        statusCodeStats: Array<{
            _id: number;
            count: number;
        }>;
        methodStats: Array<{
            _id: string;
            count: number;
        }>;
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

            const params = new URLSearchParams();
            
            if (options.limit) params.append('limit', options.limit.toString());
            if (options.page) params.append('page', options.page.toString());
            if (options.sort) params.append('sort', options.sort);
            if (options.method) params.append('method', options.method);
            if (options.statusCode) params.append('statusCode', options.statusCode.toString());

            const url = `/api-tracker/my-stats?${params.toString()}`;
            
            const response = await api.get<ApiTrackerResponse>(url);
            setData(response.data);
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
