import React from 'react';
import type { IconType } from 'react-icons/lib';
import './CanvasSidebarOption.css';
import FormField from '@/components/molecules/FormField';

interface CanvasSidebarOptionProps{
    onSelect: (option: any) => void;
    activeOption: boolean;
    option: {
        Icon: IconType;
        title: string;
    };
}

const CanvasSidebarOption: React.FC<CanvasSidebarOptionProps> = ({ option, onSelect, activeOption }) => {
   
    return (
        <div 
            className='editor-sidebar-scene-option-container' 
            onClick={() => onSelect(option)}
        >
            <i className='editor-sidebar-scene-option-icon-container'>
                <option.Icon />
            </i>
            <h3 className='editor-sidebar-scene-option-title'>{option.title}</h3>
        </div>
    );
};

export default CanvasSidebarOption;