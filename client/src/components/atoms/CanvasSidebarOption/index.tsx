import React from 'react';
import useConfigurationStore from '@/stores/editor/configuration';
import './CanvasSidebarOption.css';

interface CanvasSidebarOptionProps{
    option: string
};

const CanvasSidebarOption: React.FC<CanvasSidebarOptionProps> = ({ option }) => {
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

export default CanvasSidebarOption;