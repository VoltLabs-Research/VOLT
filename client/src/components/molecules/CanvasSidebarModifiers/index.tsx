import { useEffect, useMemo, useRef } from 'react';
import { PiEngine } from 'react-icons/pi';
import { CiImageOn } from 'react-icons/ci';
import { useNavigate } from 'react-router';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import useAnalysisConfigStore from '@/stores/analysis-config';
import DynamicIcon from '@/components/atoms/DynamicIcon';
import useEditorUIStore, { type ActiveModifier } from '@/stores/ui/editor';
import usePluginStore from '@/stores/plugins';
import './CanvasSidebarModifiers.css';

const CanvasSidebarModifiers = () => {
    const logger = useLogger('canvas-sidebar-modifiers');
    const activeModifiers = useEditorUIStore((state) => state.activeModifiers);
    const toggleModifier = useEditorUIStore((state) => state.toggleModifier);
    const modifiers = usePluginStore((state) => state.getModifiers());
    const fetchManifests = usePluginStore((state) => state.fetchManifests);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const setShowRenderConfig = useEditorUIStore((state) => state.setShowRenderConfig);
    const idRateSeries = useTrajectoryStore((state) => state.idRateSeries);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const navigate = useNavigate();

    // We save the previous state to detect which modifiers have just been activated
    const prevActiveRef = useRef<ActiveModifier[]>(activeModifiers);

    useEffect(() => {
        fetchManifests();
    }, []);

    useEffect(() => {
        if(!trajectory?._id){
            prevActiveRef.current = activeModifiers;
            return;
        }

        const prev = prevActiveRef.current.map(m => m.key);
        const current = activeModifiers.map(m => m.key);
        const justActivated = current.filter((key) => !prev.includes(key));

        for(const modifierKey of justActivated){
            logger.log('Modifier activated:', modifierKey);
            
            if(modifierKey === 'raster'){
                navigate('/raster/' + trajectory._id);
            } else if(modifierKey === 'render-settings'){
                setShowRenderConfig(true);
            }
        }

        prevActiveRef.current = activeModifiers;
    }, [activeModifiers, analysisConfig, trajectory, logger, navigate, setShowRenderConfig]);

    const allModifiers = useMemo(() => ([
        ...modifiers.map((mod) => ({
            title: mod.exposure.displayName,
            modifierId: mod.modifierId,
            Icon: () => <DynamicIcon iconName={mod.exposure.icon ?? ''} />,
            pluginId: mod.pluginId,
            pluginModifierId: mod.modifierId,
            isPlugin: true
        })),
        {
            Icon: PiEngine,
            title: 'Render Settings',
            modifierId: 'render-settings',
            isPlugin: false
        }, {
            Icon: CiImageOn,
            title: 'Raster Frames',
            modifierId: 'raster',
            isPlugin: false
        }, /*{
            Icon: GrFormViewHide,
            title: 'Dislocations Render Options',
            modifierId: 'render-options'
        }*/
    ]), [modifiers, idRateSeries?.length]);

    const handleToggle = (option: any) => {
        if(option.isPlugin){
            toggleModifier(option.modifierId, option.pluginId, option.pluginModifierId);
        } else {
            toggleModifier(option.modifierId);
        }
    };

    const isActive = (modifierId: string) => {
        return activeModifiers.some(m => m.key === modifierId);
    };

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {allModifiers.map((option) => (
                    <CanvasSidebarOption
                        key={option.modifierId}
                        option={option}
                        isLoading={option.isLoading}
                        activeOption={isActive(option.modifierId)}
                        onSelect={handleToggle} />
                ))}
            </div>
        </div>
    );
};

export default CanvasSidebarModifiers;