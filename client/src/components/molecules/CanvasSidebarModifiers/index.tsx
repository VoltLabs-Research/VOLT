import React, { useEffect, useRef } from 'react';
import { GiAtom } from 'react-icons/gi';
import { PiLineSegmentThin, PiAtomThin } from 'react-icons/pi';
import { TbSquareRotated } from 'react-icons/tb';
import { TfiSlice } from 'react-icons/tfi';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useConfigurationStore from '@/stores/editor/configuration';
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
        },
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