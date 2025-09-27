/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export interface LoginActivity {
    _id: string;
    user: string;
    action: 'login' | 'logout' | 'failed_login';
    ip: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
    createdAt: string;
}

export interface LoginActivityResponse {
    status: 'success' | 'error';
    results: number;
    data: LoginActivity[];
}

export const useLoginActivity = (limit?: number) => {
    const [activities, setActivities] = useState<LoginActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLoginActivity = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = limit ? `?limit=${limit}` : '';
            const response = await api.get(`/sessions/activity${params}`);
            setActivities(response.data.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch login activity');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLoginActivity();
    }, [limit]);

    return {
        activities,
        loading,
        error,
        refetch: fetchLoginActivity
    };
};

export default useLoginActivity;
