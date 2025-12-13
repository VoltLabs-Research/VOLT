import React, { useEffect, useRef, useState } from 'react';
import { TbObjectScan } from 'react-icons/tb';
import CanvasSidebarOption from '@/components/atoms/scene/CanvasSidebarOption';
import useModelStore from '@/stores/editor/model';
import type { Trajectory } from '@/types/models';
import usePluginStore, { type RenderableExposure } from '@/stores/plugins/plugin';
import './CanvasSidebarScene.css';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import useAnalysisConfigStore from '@/stores/analysis-config';
import { Skeleton } from '@mui/material';

interface CanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
    const setActiveScene = useModelStore((state) => state.setActiveScene);
    const activeScene = useModelStore((state) => state.activeScene);
    const getRenderableExposures = usePluginStore((state) => state.getRenderableExposures);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    const [pluginExposures, setPluginExposures] = useState<RenderableExposure[]>([]);
    const [loading, setLoading] = useState(true);

    const analysisConfigId = analysisConfig?._id;
    const activeSceneRef = useRef(activeScene);

    useEffect(() => {
        activeSceneRef.current = activeScene;
    }, [activeScene]);

    useEffect(() => {
        if(!trajectory?._id || !analysisConfigId){
            setLoading(false);
            return;
        }

        // Don't load renderable models if trajectory has no analysis
        if(!trajectory.analysis || trajectory.analysis.length === 0){
            setLoading(false);
            setPluginExposures([]);
            return;
        }

        const loadExposures = async() => {
            setLoading(true);
            setPluginExposures([]);
            try{
                const exposures = await getRenderableExposures(trajectory._id, analysisConfigId);
                setPluginExposures(exposures);
            }catch(error){
                console.error('Failed to load plugin exposures:', error);
            }finally{
                setLoading(false);
            }
        };

        loadExposures();
    }, [trajectory?._id, trajectory?.analysis, analysisConfigId, getRenderableExposures]);

    useEffect(() => {
        if(loading || !analysisConfigId) return;
        const currentScene = activeSceneRef.current;
        if(!currentScene || currentScene.source !== 'plugin') return;
        if(currentScene.analysisId === analysisConfigId) return;

        const matchingExposure = pluginExposures.find(
            (exposure) => exposure.exposureId === currentScene.sceneType
        );

        if(matchingExposure){
            setActiveScene({
                sceneType: matchingExposure.exposureId,
                source: 'plugin',
                analysisId: matchingExposure.analysisId,
                exposureId: matchingExposure.exposureId
            });
            return;
        }

        if(pluginExposures.length > 0){
            const nextExposure = pluginExposures[0];
            setActiveScene({
                sceneType: nextExposure.exposureId,
                source: 'plugin',
                analysisId: nextExposure.analysisId,
                exposureId: nextExposure.exposureId
            });
            return;
        }

        setActiveScene({ sceneType: 'trajectory', source: 'default' });
    }, [analysisConfigId, loading, pluginExposures, setActiveScene]);

    const defaultOptions = [{
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        sceneType: { sceneType: 'trajectory', source: 'default' }
    }];

    const pluginOptions = pluginExposures.map((exposure) => ({
        Icon: () => <DynamicIcon iconName={exposure.icon!} />,
        title: exposure.name || exposure.exposureId,
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

    const onSelect = (option: any) => {
        console.log('Selected option:', option)
        setActiveScene(option.sceneType);
    };

    return(
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {defaultOptions.map((option, index) => (
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
                                modifierId: ''
                            }}
                        />
                    </div>
                ))}

                {loading && (
                    Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton
                            key={`plugin-exposure-skeleton-${index}`}
                            variant="rounded"
                            height={48}
                            sx={{ width: '100%', mb: 1.5, borderRadius: 2 }}
                        />
                    ))
                )}

                {!loading && pluginOptions.map((option, index) => (
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
