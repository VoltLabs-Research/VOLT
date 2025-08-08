import React from 'react';
import { TbObjectScan } from 'react-icons/tb';
import { PiAtomThin, PiLineSegmentThin, PiTriangleDashedThin } from 'react-icons/pi';
import { SiTraefikmesh } from 'react-icons/si';
import { IoIosColorFilter } from 'react-icons/io';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useConfigurationStore from '@/stores/editor/configuration';
import './CanvasSidebarScene.css';

const CanvasSidebarScene: React.FC = () => {
    const setActiveSceneObject = useConfigurationStore((state) => state.activeSceneObject);
    const activeSceneObject = useConfigurationStore((state) => state.activeSceneObject);

    const options = [{
        Icon: TbObjectScan,
        title: 'Camera 1',
        sceneType: 'trajectory'
    }, {
        Icon: PiLineSegmentThin,
        title: 'Dislocations',
        sceneType: 'dislocations'
    }, {
        Icon: SiTraefikmesh,
        title: 'Defect Mesh',
        sceneType: 'defect_mesh'
    }, {
        Icon: PiAtomThin,
        title: 'Dislocation Core Atoms',
        sceneType: 'core_atoms'
    }, {
        Icon: PiTriangleDashedThin,
        title: 'Interface Mesh',
        sceneType: 'interface_mesh'
    }, {
        Icon: IoIosColorFilter,
        title: 'Structure Identification',
        sceneType: 'atoms_colored_by_type'
    }];

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {options.map((option, index) => (
                    <CanvasSidebarOption
                        onSelect={setActiveSceneObject}
                        activeOption={activeSceneObject}
                        option={option}
                        key={index}
                    />
                ))}
            </div>
        </div>
    );
};

export default CanvasSidebarScene;