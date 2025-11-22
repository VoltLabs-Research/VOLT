import React from 'react';
import { TbObjectScan } from 'react-icons/tb';
import { PiAtomThin, PiLineSegmentThin, PiTriangleDashedThin } from 'react-icons/pi';
import { SiTraefikmesh } from 'react-icons/si';
import { IoIosColorFilter } from 'react-icons/io';
import CanvasSidebarOption from '@/components/atoms/CanvasSidebarOption';
import useModelStore, { type SceneObjectType } from '@/stores/editor/model';
import type { Trajectory } from '@/types/models';
import './CanvasSidebarScene.css';

interface CanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
    const setActiveScene = useModelStore((state) => state.setActiveScene);
    const activeScene = useModelStore((state) => state.activeScene);

    const options = [{
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        sceneType: 'trajectory',
        isAvailable: trajectory?.availableModels?.atomicStructure ?? true
    }, /*{
        Icon: PiLineSegmentThin,
        title: 'Dislocations',
        sceneType: 'dislocations',
        isAvailable: trajectory?.availableModels?.dislocations ?? true
    }, {
        Icon: SiTraefikmesh,
        title: 'Defect Mesh',
        sceneType: 'defect_mesh',
        isAvailable: trajectory?.availableModels?.dislocations ?? true
    }, {
        Icon: PiAtomThin,
        title: 'Dislocation Core Atoms',
        sceneType: 'core_atoms',
        isAvailable: trajectory?.availableModels?.dislocations ?? true
    }, {
        Icon: PiTriangleDashedThin,
        title: 'Interface Mesh',
        sceneType: 'interface_mesh',
        isAvailable: trajectory?.availableModels?.dislocations ?? true
    }, {
        Icon: IoIosColorFilter,
        title: 'Structure Identification',
        sceneType: 'atoms_colored_by_type',
        isAvailable: trajectory?.availableModels?.structureIdentification ?? true
    }*/];

    const onSelect = (option: SceneObjectType) => {
        setActiveScene(option.sceneType);
    };

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container'>
                {options.map((option, index) => (
                    <div
                        key={index}
                        style={{
                            opacity: option.isAvailable ? 1 : 0.4,
                            pointerEvents: option.isAvailable ? 'auto' : 'none'
                        }}
                    >
                        <CanvasSidebarOption
                            onSelect={onSelect}
                            activeOption={activeScene}
                            option={option}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CanvasSidebarScene;