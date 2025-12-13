import React from 'react';
import type { FloatingMenuItemProps } from '@/types/floating-container';

const FloatingMenuItem: React.FC<FloatingMenuItemProps> = ({
    name,
    Icon,
    onClick,
    onItemClick
}) => {
    return(
        <div
            className='action-based-floating-option-container'
            onClick={(e) => onItemClick(onClick, e)}
        >
            <i className='action-based-floating-option-icon-container'>
                <Icon />
            </i>

            <span className='action-based-floating-option-name-container'>
                {name}
            </span>
        </div>
    );
};

export default FloatingMenuItem;
