/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
