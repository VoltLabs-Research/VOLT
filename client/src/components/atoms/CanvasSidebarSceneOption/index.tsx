import React from 'react';
import useConfigurationStore, { type SceneObjectType } from '@/stores/editor/configuration';
import type { IconType } from 'react-icons/lib';
import './CanvasSidebarSceneOption.css';

interface CanvasSidebarSceneOptionProps{
    option: {
        Icon: IconType;
        title: string;
        sceneType: SceneObjectType;
    }
}

const CanvasSidebarSceneOption: React.FC<CanvasSidebarSceneOptionProps> = ({ option }) => {
    const setActiveSceneObject = useConfigurationStore((state) => state.setActiveSceneObject);
    
    return (
        <div 
            className='editor-sidebar-scene-option-container' 
            onClick={() => setActiveSceneObject(option.sceneType)}
        >
            <i className='editor-sidebar-scene-option-icon-container'>
                <option.Icon />
            </i>
            <h3 className='editor-sidebar-scene-option-title'>{option.title}</h3>
        </div>
    );
};

export default CanvasSidebarSceneOption;