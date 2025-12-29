import React from 'react';
import type { IconType } from 'react-icons/lib';
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { RiMore2Fill } from "react-icons/ri";
import Loader from '@/components/atoms/common/Loader';
import Title from '@/components/primitives/Title';
import './CanvasSidebarOption.css';

interface CanvasSidebarOptionProps {
    onSelect: (option: any) => void;
    activeOption: boolean;
    option: {
        Icon: IconType;
        title: string;
        modifierId: string;
        options?: [{
            title: string;
            modifierId: string;
        }]
    };
    isLoading: boolean;
    secondaryAction?: React.ReactNode;
}

const CanvasSidebarOption: React.FC<CanvasSidebarOptionProps & React.HTMLAttributes<HTMLDivElement>> = ({
    option,
    onSelect,
    activeOption,
    isLoading,
    secondaryAction,
    className,
    ...rest
}) => {

    return (
        <>
            <div
                {...rest}
                className={`d-flex content-between items-center editor-sidebar-scene-option-container ${activeOption ? 'active-option' : ''} cursor-pointer ${className || ''}`}
                onClick={() => onSelect(option)}
            >
                <div className='d-flex items-center gap-1 editor-sidebar-scene-option-left-container'>
                    <i className='editor-sidebar-scene-option-icon-container'>
                        <option.Icon />
                    </i>
                    <Title className='font-size-3-5 editor-sidebar-scene-option-title'>{option.title}</Title>
                </div>

                {secondaryAction && (
                    <div className='editor-sidebar-scene-option-right-container' onClick={(e) => e.stopPropagation()}>
                        {secondaryAction}
                    </div>
                )}

                {option.options && (
                    <div className='editor-sidebar-scene-option-right-container'>
                        <i className='editor-sidebar-scene-option-dropdown-icon-container'>
                            {activeOption ? (
                                isLoading ? <Loader scale={0.5} /> : <RiArrowUpSLine />
                            ) : (
                                <RiArrowDownSLine />
                            )}
                        </i>
                    </div>
                )}
            </div>

            {(option.options && activeOption && !isLoading) && (
                <div className={`editor-sidebar-scene-option-select-container p-relative`}>
                    {option.options.map(({ title, modifierId }, index) => (
                        <div
                            className={`d-flex content-between items-center editor-sidebar-scene-option-container ${activeOption ? 'active-option' : ''} cursor-pointer`}
                            onClick={() => onSelect({ title, modifierId })}
                            key={title + '-' + index}
                        >
                            <Title className='font-size-3 editor-sidebar-scene-option-title'>{title}</Title>
                            <i className='editor-sidebar-scene-option-more-icon-container'>
                                <RiMore2Fill />
                            </i>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default CanvasSidebarOption;
