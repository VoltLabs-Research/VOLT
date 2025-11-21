import { useEffect, useMemo, useRef } from 'react';
import { PiEngine } from 'react-icons/pi';
import { IoIosStats } from "react-icons/io";
import { CiImageOn } from 'react-icons/ci';
import { useNavigate } from 'react-router';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import useAnalysisConfigStore from '@/stores/analysis-config';
import DynamicIcon from '@/components/atoms/DynamicIcon';
import useEditorUIStore from '@/stores/ui/editor';
import useModifiersStore from '@/stores/modifiers';
import usePluginStore from '@/stores/plugins';
import './CanvasSidebarModifiers.css';

const CanvasSidebarModifiers = () => {
    const logger = useLogger('canvas-sidebar-modifiers');
    const activeModifiers = useEditorUIStore((state) => state.activeModifiers);
    const toggleModifiers = useEditorUIStore((state) => state.toggleModifier);
    const modifiers = usePluginStore((state) => state.getModifiers());
    const fetchManifests = usePluginStore((state) => state.fetchManifests);

    const structureIdentification = useModifiersStore((state) => state.structureIdentification);
    const computeAnalyses = useModifiersStore((state) => state.computeAnalyses);
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    const setShowRenderConfig = useEditorUIStore((state) => state.setShowRenderConfig);

    const idRateSeries = useTrajectoryStore((state) => state.idRateSeries);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const navigate = useNavigate();

    // We save the previous state to detect which modifiers have just been activated
    const prevActiveRef = useRef<string[]>(activeModifiers);

    useEffect(() => {
        fetchManifests();
    }, []);

    useEffect(() => {
        if(!trajectory?._id){
            prevActiveRef.current = activeModifiers;
            return;
        }

        const prev = prevActiveRef.current;
        const justActivated = activeModifiers.filter((modifier) => !prev.includes(modifier));

        // Only for those who matter
        for(const modifier of justActivated){
            logger.log('Modifier:', modifier);
            if(modifier === 'PTM' || modifier === 'CNA' || modifier === 'DIAMOND'){
                structureIdentification(trajectory?._id, analysisConfig, modifier);
            }else if(modifier === 'compute-analysis-differences'){
                computeAnalyses(trajectory?._id);
            }else if(modifier === 'raster'){
                navigate('/raster/' + trajectory._id);
            }else if(modifier === 'render-settings'){
                setShowRenderConfig(true);
            }
        }

        prevActiveRef.current = activeModifiers;
    }, [activeModifiers, analysisConfig, structureIdentification, trajectory, logger]);

    const allModifiers = useMemo(() => ([
        ...modifiers.map((mod) => ({
            title: mod.exposure.displayName,
            modifierId: mod.modifierId,
            Icon: () => <DynamicIcon iconName={mod.exposure.icon ?? ''} />
        })),
        {
            Icon: PiEngine,
            title: 'Render Settings',
            modifierId: 'render-settings'
        }, {
            Icon: CiImageOn,
            title: 'Raster Frames',
            modifierId: 'raster'
        }, {
            Icon: IoIosStats,
            title: 'Analysis Metrics',
            modifierId: 'compute-analysis-differences',
            isLoading: !idRateSeries?.length,
            options: [{
                title: 'Total Dislocation Segments',
                modifierId: 'total-dislocation-segments'
            }, {
                title: 'Average Segment Length',
                modifierId: 'average-segment-length'
            }, {
                title: 'Identification Rate',
                modifierId: 'structure-identification-rate'
            }]
        }, /*{
            Icon: GrFormViewHide,
            title: 'Dislocations Render Options',
            modifierId: 'render-options'
        }*/
    ]), [modifiers, idRateSeries?.length]);

    return (
        <>
            <div className='editor-sidebar-scene-container'>
                <div className='editor-sidebar-scene-options-container'>
                    {allModifiers.map((option) => (
                        <CanvasSidebarOption
                            key={option.modifierId}
                            option={option}
                            isLoading={option.isLoading}
                            activeOption={activeModifiers.includes(option.modifierId ? option.modifierId : '')}
                            onSelect={(option) => toggleModifiers(option.modifierId)} />
                    ))}
                </div>
            </div>
        </>
    );
};

export default CanvasSidebarModifiers;