import React from 'react';
import { GiAtom } from 'react-icons/gi';
import { PiLineSegmentThin, PiAtomThin } from 'react-icons/pi';
import { TbSquareRotated } from 'react-icons/tb';
import { TfiSlice } from 'react-icons/tfi';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useConfigurationStore from '@/stores/editor/configuration';
import './CanvasSidebarModifiers.css';

const CanvasSidebarModifiers = () => {
    const activeModifier = useConfigurationStore((state) => state.activeModifier);
    const setActiveModifier = useConfigurationStore((state) => state.setActiveModifier);

    const modifiers = [{
        Icon: PiLineSegmentThin,
        title: 'Dislocation Analysis'
    }, {
        Icon: TbSquareRotated,
        title: 'Missorientation'
    }, {
        Icon: TfiSlice,
        title: 'Slice' 
    }, {
        Icon: GiAtom,
        title: 'Common Neighbor Analysis'
    }, {
        Icon: PiAtomThin,
        title: 'Polyhedral Template Matching'
    }];

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {modifiers.map((modifier, index) => (
                    <CanvasSidebarOption 
                        key={index}
                        onSelect={setActiveModifier}
                        option={modifier}
                        activeOption={activeModifier} />
                ))}
            </div>
        </div>
    )
};

export default CanvasSidebarModifiers;