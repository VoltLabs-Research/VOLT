import React from 'react';
import useConfigurationStore, { type SceneObjectType } from '@/stores/editor/configuration';
import './CanvasSidebarSceneOption.css';

interface CanvasSidebarSceneOptionProps{
    Icon: any;
    title: string;
    sceneType: SceneObjectType;
}

const CanvasSidebarSceneOption: React.FC<CanvasSidebarSceneOptionProps> = ({ Icon, title, sceneType }) => {
    const setActiveSceneObject = useConfigurationStore((state) => state.setActiveSceneObject);
    
    return (
        <div 
            className='editor-sidebar-scene-option-container' 
            onClick={() => setActiveSceneObject(sceneType)}
        >
            <i className='editor-sidebar-scene-option-icon-container'>
                <Icon />
            </i>
            <h3 className='editor-sidebar-scene-option-title'>{title}</h3>
        </div>
    );
};

export default CanvasSidebarSceneOption;