import { useEffect, useState } from 'react';
import usePluginStore from '@/stores/plugins';
import type { Modifier } from '@/types/stores/plugins';

const useModifiers = () => {
    const manifests = usePluginStore((state) => state.manifests);
    const isLoading = usePluginStore((state) => state.loading);
    const fetch = usePluginStore((state) => state.fetch);
    const [modifiers, setModifiers] = useState<any[]>([])

    useEffect(() => {
        console.log('MODIFIERS:', modifiers);
    }, [modifiers]);

    useEffect(() => {
        if(manifests.length === 0){
            fetch();
            return;
        }

        for(const [pluginId, pluginManifest] of Object.entries(manifests)){
            const pluginModifiers = [];
            for(const [modifierId, modifier] of Object.entries(pluginManifest.modifiers)){
                const { exposure, preset } = pluginManifest.modifiers[modifierId];
                if(!exposure) continue;
                pluginModifiers.push({
                    pluginId,
                    modifierId,
                    exposure: exposure[modifierId], 
                    preset
                });
            }
            console.log('PLUGIN MODIFIERS:::', pluginModifiers)
            setModifiers(modifiers.concat(pluginModifiers));
        }
    }, [manifests]);

    return { modifiers };
};

export default useModifiers;