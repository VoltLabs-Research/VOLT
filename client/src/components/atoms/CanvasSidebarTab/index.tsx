import React from 'react';
import useConfigurationStore from '@/stores/editor/configuration';
import './CanvasSidebarTab.css';

interface CanvasSidebarTabProps{
    option: string
};

const CanvasSidebarTab: React.FC<CanvasSidebarTabProps> = ({ option }) => {
    const setActiveSidebarTag = useConfigurationStore((state) => state.setActiveSidebarTag);
    const activeSidebarTab = useConfigurationStore((state) => state.activeSidebarTab);

    return (
        <div 
            className={'editor-sidebar-option-container '.concat((option === activeSidebarTab) ? 'selected': '')} 
            onClick={() => setActiveSidebarTag(option)}
        >
            <h3 className='editor-sidebar-option-title'>{option}</h3>
        </div>
    );
};

export default CanvasSidebarTab;