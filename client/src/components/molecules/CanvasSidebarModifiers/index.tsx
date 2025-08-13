import React, { useEffect, useRef } from 'react';
import { GiAtom } from 'react-icons/gi';
import { PiLineSegmentThin, PiAtomThin } from 'react-icons/pi';
import { GrFormViewHide } from "react-icons/gr";
import { IoIosStats } from "react-icons/io";
import { TfiSlice } from 'react-icons/tfi';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useUIStore from '@/stores/ui';
import './CanvasSidebarModifiers.css';

const CanvasSidebarModifiers = () => {
    const logger = useLogger('canvas-sidebar-modifiers');
    const activeModifiers = useUIStore((state) => state.activeModifiers);
    const toggleModifiers = useUIStore((state) => state.toggleModifier);

    const structureIdentification = useTrajectoryStore((state) => state.structureIdentification);
    const computeAnalysisDifferences = useTrajectoryStore((state) => state.computeAnalysisDifferences);
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    // We save the previous state to detect which modifiers have just been activated
    const prevActiveRef = useRef<string[]>(activeModifiers);

    useEffect(() => {
        if(!trajectory?._id){
            prevActiveRef.current = activeModifiers;
            return;
        }

        const prev = prevActiveRef.current;
        const justActivated = activeModifiers.filter((modifier) => !prev.includes(modifier));

        // Only for those who matter
        for(const modifier of justActivated){
            console.log('modifier', modifier);
            if(modifier === 'PTM' || modifier === 'CNA'){
                logger.log('Activating structure identification:', modifier);
                structureIdentification(trajectory?._id, analysisConfig, modifier);
            }else if(modifier === 'compute-analysis-differences'){
                computeAnalysisDifferences(trajectory?._id);
            }
        }

        prevActiveRef.current = activeModifiers;
    }, [activeModifiers, analysisConfig, structureIdentification, trajectory, logger]);

    const modifiers = [{
            Icon: PiLineSegmentThin,
            title: 'Dislocation Analysis', 
            modifierId: 'dislocation-analysis-config' 
        }, {
            Icon: TfiSlice,
            title: 'Slice Plane',
            modifierId: 'slice-plane' 
        }, {
            Icon: GiAtom,
            title: 'Common Neighbor Analysis', 
            modifierId: 'CNA' 
        }, {
            Icon: PiAtomThin,
            title: 'Polyhedral Template Matching', 
            modifierId: 'PTM' 
        }, {
            Icon: IoIosStats,
            title: 'Compute Analysis Differences',
            modifierId: 'compute-analysis-differences'
        }, {
            Icon: GrFormViewHide,
            title: 'Render Options',
            modifierId: 'render-options'
        }
    ];

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {modifiers.map((option, index) => (
                    <CanvasSidebarOption
                        key={index}
                        option={option}
                        activeOption={activeModifiers.includes(option.modifierId ? option.modifierId : '')}
                        onSelect={(option) => toggleModifiers(option.modifierId)} />
                ))}
            </div>
        </div>
    );
};

export default CanvasSidebarModifiers;