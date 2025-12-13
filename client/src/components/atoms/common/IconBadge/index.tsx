import React from 'react';

interface IconBadgeProps {
    children: React.ReactNode;
    size?: number; // px size of square container
}

const IconBadge: React.FC<IconBadgeProps> = ({ children, size = 40 }) => {
    return(
        <div className='icon-badge' style={{ width: size, height: size }}>
            {children}
        </div>
    );
};

export default IconBadge;
