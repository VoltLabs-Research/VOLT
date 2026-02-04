import { useState, useEffect } from 'react';
import sessionApi from '@/features/auth/api/session';

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

    const fetchLoginActivity = async() => {
        try{
            setLoading(true);
            setError(null);
            const data = await sessionApi.getLoginActivity(limit ? { limit } : undefined);
            setActivities(data as unknown as LoginActivity[]);
        }catch(err: any){
            setError(err.response?.data?.message || 'Failed to fetch login activity');
        }finally{
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
