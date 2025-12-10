import React, { type ReactNode } from 'react';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';

export interface NodeBadgeProps{
    icon?: string;
    children: ReactNode;
};

const NodeBadge = ({ icon, children }: NodeBadgeProps) => {
    <span className='workflow-node-badge-container'>
        {icon && <DynamicIcon iconName={icon} />}
        {children}
    </span>
};

export default NodeBadge;