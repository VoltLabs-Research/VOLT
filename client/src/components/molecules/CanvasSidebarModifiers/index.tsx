import React, { useEffect } from 'react';
import { GiAtom } from 'react-icons/gi';
import { PiLineSegmentThin, PiAtomThin } from 'react-icons/pi';
import { TbSquareRotated } from 'react-icons/tb';
import { TfiSlice } from 'react-icons/tfi';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useConfigurationStore from '@/stores/editor/configuration';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import './CanvasSidebarModifiers.css';

const CanvasSidebarModifiers = () => {
    const activeModifier = useConfigurationStore((state) => state.activeModifier);
    const setActiveModifier = useConfigurationStore((state) => state.setActiveModifier);
    const structureIdentification = useTrajectoryStore((state) => state.structureIdentification);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const analysisConfig = useConfigurationStore((state) => state.analysisConfig);
    const logger = useLogger('canvas-sidebar-modifiers');

    useEffect(() => {
        if(!activeModifier?.length || !trajectory?._id) return;
        logger.log('Active modifier:', activeModifier);

        switch(activeModifier){
            case 'PTM':
            case 'CNA':
                structureIdentification(trajectory._id, analysisConfig, activeModifier);
                break;
        }
        
    }, [trajectory, analysisConfig, activeModifier]);

    const modifiers = [{
        Icon: PiLineSegmentThin,
        title: 'Dislocation Analysis',
        modifierId: 'dislocation-analysis'
    }, {
        Icon: TbSquareRotated,
        modifierId: 'missorientation',
        title: 'Missorientation'
    }, {
        Icon: TfiSlice,
        modifierId: 'slice',
        title: 'Slice' 
    }, {
        Icon: GiAtom,
        modifierId: 'CNA',
        title: 'Common Neighbor Analysis'
    }, {
        Icon: PiAtomThin,
        modifierId: 'PTM',
        title: 'Polyhedral Template Matching'
    }];

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {modifiers.map((modifier, index) => (
                    <CanvasSidebarOption 
                        key={index}
                        onSelect={(option) => setActiveModifier(option.modifierId)}
                        option={modifier}
                        activeOption={activeModifier} />
                ))}
            </div>
        </div>
    )
};

export default CanvasSidebarModifiers;