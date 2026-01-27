import React from 'react';

type Variant = 'active' | 'inactive' | 'danger' | 'neutral';

interface StatusBadgeProps {
    variant?: Variant;
    children: React.ReactNode;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ variant = 'neutral', children }) => {
    return(
        <span className={`status-badge ${variant} font-size-1 font-weight-5 font-weight-6`}>
            {children}
        </span>
    );
};

export default StatusBadge;
