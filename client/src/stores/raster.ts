import { create } from 'zustand';
import { api } from '@/services/api';
import { dataURLToObjectURL } from './trajectories';

interface RasterState {
    trajectory: any;
    isLoading: boolean;
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
    error: null
};

const useRasterStore = create<RasterState & {
    getRasterFrames: (id: string) => Promise<void>;
    clearRasterData: () => void;
    revokeUrls: () => void;
}>((set, get) => {
    return {
        ...initialState,

        async getRasterFrames(id: string){
            const params = new URLSearchParams();
            params.set('includeData', 'true');
            set({ isLoading: true, error: null });

            try{
                const res = await api.get(`/trajectories/${id}/glb/raster?${params.toString()}`);
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
                    
                    analyses.forEach((analysis) => {
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