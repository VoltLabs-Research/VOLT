import { create } from 'zustand';
import { api } from '@/api';
import type { ApiResponse } from '@/types/api';
import type { Manifest } from '@/types/stores/plugins';

interface PluginState{
    plugins: string[];
    manifests: Manifest[];
    error?: string;
    loading: boolean;
    fetch: () => Promise<void>;  
};

const usePluginStore = create<PluginState>((set, get) => ({
    plugins: [],
    loading: false,
    error: undefined,
    manifests: [],

    fetch: async () => {
        if(get().loading) return;
        set({ loading: true, error: undefined });
        try{
            console.log('RES:/api/plugins/manifests/ ')
            const res: any = await api.get<ApiResponse<any[]>>(`/plugins/manifests/`);
            const { pluginIds, manifests } = res.data.data;
            set({ plugins: pluginIds, manifests });
        }catch(err: any){
            console.log('EROR:', err);
            set({ loading: false, error: err?.message || 'Failed to load notifications' });
        }
    }
}));

export default usePluginStore;