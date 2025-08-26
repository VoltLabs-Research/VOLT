import { create } from 'zustand';
import type { ModelStore } from '@/types/stores/editor/model';

const initialState = {
    activeModel: null,
    activeScene: 'trajectory',
    isModelLoading: false
};

const useModelStore = create<ModelStore>()((set, get) => ({
    ...initialState,

    setActiveScene(scene){
        set({ activeScene: scene });
    },

    setModelBounds(modelBounds: any){
        const { activeModel } = get();
        if(!activeModel) return;
        
        set({
            activeModel: { ...activeModel, modelBounds }
        });
    },

    setIsModelLoading(loading: boolean){
        set({ isModelLoading: loading });
    },

    selectModel(glbs: any){
        set({ activeModel: { glbs } });
    },

    reset(){
        set(initialState);
    }
}));

export default useModelStore;