import { create } from 'zustand';
import { api } from '@/services/api';
import { dataURLToObjectURL } from './trajectories';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { ApiResponse } from '@/types/api';

interface RasterState {
    trajectory: any;
    isLoading: boolean;
    isAnalysisLoading: boolean;
    rasterData: {
        items: any[];
        byFrame: Record<number, any[]>;
        byFrameUrls: Record<number, Record<string, string>>;
        itemUrls: Record<string, string>;
    } | null;
    error: string | null;
}

const initialState: RasterState = {
    trajectory: null,
    isLoading: false,
    rasterData: null,
    isAnalysisLoading: true,
    error: null
};

const useRasterStore = create<RasterState & {
    getRasterFrames: (id: string) => Promise<void>;
    clearRasterData: () => void;
    revokeUrls: () => void;
}>((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        ...initialState,

        rasterize: (id: string) => asyncAction(() => api.post<ApiResponse<any>>(`/raster/${id}/glb/`), {
            loadingKey: 'isAnalysisLoading',
            onSuccess: (res) => {
                return { rasterData: res.data.data };
            }
        }),

        async getRasterFrames(id: string){
            set({ isLoading: true, error: null });

            try{
                const res = await api.get(`/raster/${id}/glb`);
                const items: any[] = res?.data?.data?.items ?? [];
                const byFrame = res.data?.data?.byFrame ?? {};

                const currentData = get().rasterData;
                if(currentData){
                    Object.values(currentData.itemUrls || {}).forEach((url) => {
                        if(url) URL.revokeObjectURL(url);
                    });
                    
                    Object.values(currentData.byFrameUrls || {}).forEach((frameUrls) => {
                        Object.values(frameUrls).forEach(url => {
                            if(url) URL.revokeObjectURL(url);
                        });
                    });
                }

                const itemUrls: Record<string, string> = {};
                for(const item of items){
                    if(!item.data) continue;
                    itemUrls[item.filename] = dataURLToObjectURL(item.data);
                }

                const byFrameUrls: Record<number, Record<string, string>> = {};
                Object.keys(byFrame).forEach((frameKey) => {
                    const frame = parseInt(frameKey, 10);
                    byFrameUrls[frame] = {};
                    const analyses = byFrame[frame] || [];
                    
                    analyses.forEach((analysis: any) => {
                        if(analysis.data){
                            byFrameUrls[frame][analysis.filename] = dataURLToObjectURL(analysis.data);
                        }
                    });
                });

                const rasterData = {
                    items,
                    byFrame,
                    byFrameUrls,
                    itemUrls
                };

                set({
                    trajectory: res.data.data.trajectory,
                    isLoading: false,
                    rasterData,
                    error: null
                });

            }catch(error){
                console.error('Error loading raster frames:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        },

        clearRasterData() {
            const currentData = get().rasterData;
            if(currentData){
                Object.values(currentData.itemUrls || {}).forEach(url => {
                    if(url) URL.revokeObjectURL(url);
                });
                
                Object.values(currentData.byFrameUrls || {}).forEach(frameUrls => {
                    Object.values(frameUrls).forEach(url => {
                        if(url) URL.revokeObjectURL(url);
                    });
                });
            }
            
            set({ rasterData: null, trajectory: null, error: null });
        },

        revokeUrls() {
            const currentData = get().rasterData;
            if(currentData){
                Object.values(currentData.itemUrls || {}).forEach((url) => {
                    if(url) URL.revokeObjectURL(url);
                });
                
                Object.values(currentData.byFrameUrls || {}).forEach((frameUrls) => {
                    Object.values(frameUrls).forEach(url => {
                        if(url) URL.revokeObjectURL(url);
                    });
                });
            }
        }
    };
});

export default useRasterStore;