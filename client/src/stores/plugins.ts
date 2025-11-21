import { create } from 'zustand';
import { api } from '@/api';
import type { ApiResponse } from '@/types/api';
import type { Exposure, Manifest } from '@/types/stores/plugins';

export type ManifestsByPluginId = Record<string, Manifest>;

export interface PluginState{
    plugins: string[];
    manifests: ManifestsByPluginId;
    error: string | null;
    loading: boolean;
    fetchManifests: () => Promise<void>;
    getModifiers: () => ResolvedModifier[];
};

export type ResolvedModifier = {
    pluginId: string;
    modifierId: string;
    exposure: Exposure;
    preset?: Record<string, any>;
};

const computeModifiers = (manifests: ManifestsByPluginId): ResolvedModifier[] => {
    const out: ResolvedModifier[] = [];
    for(const [pluginId, manifest] of Object.entries(manifests)){
        console.log('PluginID:', pluginId, 'manifest:', manifest);
        const mods = manifest.modifiers ?? {};
        for(const [modifierId, modifier] of Object.entries(mods)){
            console.log('ModifierID:', modifierId, 'modifier:', modifier)
            const { exposure, preset } = modifier;
            if(!exposure) continue;
            const modifierExposure = exposure[modifierId] ?? exposure;
            out.push({
                pluginId,
                modifierId,
                exposure: modifierExposure,
                preset
            });
        }
    }
    return out;
};

const usePluginStore = create<PluginState>((set, get) => {
    let lastManifests: ManifestsByPluginId | null = null;
    let lastModifiers: ResolvedModifier[] = [];

    return {
        plugins: [],
        manifests: {},
        loading: false,
        error: null,

        async fetchManifests(){
            if(get().loading) return;
            set({ loading: true, error: null });
            
            try{
                const res = await api.get<
                    ApiResponse<{ pluginIds: string[]; manifests: ManifestsByPluginId }>
                >('/plugins/manifests/');
                const { pluginIds, manifests } = res.data.data;

                set({
                    plugins: pluginIds,
                    manifests,
                    loading: false,
                    error: null
                });
            }catch(err: any){
                set({
                    loading: false,
                    error: err?.message ?? "Failed to load plugin manifests"
                });
            }
        },

        getModifiers(){
            const { manifests } = get();
            if(manifests === lastManifests){
                return lastModifiers;
            }

            lastManifests = manifests;
            lastModifiers = computeModifiers(manifests);
            console.log('LAST MODIFIERS:', lastModifiers);
            return lastModifiers;
        }
    };
});

export default usePluginStore;