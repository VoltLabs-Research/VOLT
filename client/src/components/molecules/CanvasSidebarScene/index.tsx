import React, { useEffect, useState } from 'react';
import { TbObjectScan } from 'react-icons/tb';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useModelStore from '@/stores/editor/model';
import type { Trajectory } from '@/types/models';
import usePluginStore, { type RenderableExposure } from '@/stores/plugins';
import './CanvasSidebarScene.css';
import DynamicIcon from '@/components/atoms/DynamicIcon';
import useAnalysisConfigStore from '@/stores/analysis-config';

interface CanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
    const setActiveScene = useModelStore((state) => state.setActiveScene);
    const activeScene = useModelStore((state) => state.activeScene);
    const getRenderableExposures = usePluginStore((state) => state.getRenderableExposures);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    const [pluginExposures, setPluginExposures] = useState<RenderableExposure[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if(!trajectory?._id || !analysisConfig?._id) return;

        const loadExposures = async () => {
            setLoading(true);
            try{
                const exposures = await getRenderableExposures(trajectory?._id);
                setPluginExposures(exposures);
            }catch(error){
                console.error('Failed to load plugin exposures:', error);
            }finally{
                setLoading(false);
            }
        };

        loadExposures();
    }, [trajectory?._id, analysisConfig, getRenderableExposures]);

    const defaultOptions = [{
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        sceneType: { sceneType: 'trajectory', source: 'default' }
    }];

    const pluginOptions = pluginExposures.map((exposure) => ({
        Icon: () => <DynamicIcon iconName={exposure.icon!} />,
        title: exposure.displayName || exposure.exposureId,
        sceneType: {
            sceneType: exposure.exposureId,
            source: 'plugin',
            analysisId: exposure.analysisId,
            exposureId: exposure.exposureId
        },
        pluginInfo: {
            pluginId: exposure.pluginId,
            modifierId: exposure.modifierId
        }
    }));

    const allOptions = [...defaultOptions, ...pluginOptions];

    const onSelect = (option: any) => {
        console.log('Selected option:', option)
        setActiveScene(option.sceneType);
    };

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {allOptions.map((option, index) => (
                    <div
                        key={`${option.sceneType.source}-${option.sceneType.sceneType}-${index}`}
                    >
                        <CanvasSidebarOption
                            onSelect={() => onSelect(option)}
                            activeOption={false}
                            isLoading={false}
                            option={{
                                Icon: option.Icon,
                                title: option.title,
                                modifierId: option?.pluginInfo?.modifierId
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CanvasSidebarScene;