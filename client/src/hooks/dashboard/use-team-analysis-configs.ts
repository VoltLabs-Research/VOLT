import { useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';

type ConfigItem = {
  _id: string;
  crystalStructure: string;
  identificationMode: string;
  createdAt?: string;
  trajectory?: { _id: string; name: string } | string;
};

type ResponseShape = {
  configs: ConfigItem[];
  total: number;
  page: number;
  limit: number;
};

export const useTeamAnalysisConfigs = (teamId?: string, opts?: { limit?: number }) => {
  const limit = Math.max(1, Math.min(20, opts?.limit ?? 6));
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if(!teamId){ setItems([]); setError(null); setLoading(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    (async () => {
      try{
        const res = await api.get<{ status: string; data: ResponseShape }>(`/analysis-config/team/${teamId}`,
          { params: { page: 1, limit }, signal: controller.signal });
        if(controller.signal.aborted) return;
        setItems(res.data?.data?.configs ?? []);
      }catch(err: any){
        if(controller.signal.aborted){ setLoading(false); return; }
        const message = err?.response?.data?.message || err?.message || 'Failed to load analysis configs';
        setError(message);
      }finally{
        if(!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [teamId, limit]);

  return { items, loading, error };
};

export default useTeamAnalysisConfigs;
