import React from 'react';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Paragraph from '@/shared/presentation/components/Paragraph';

interface PermissionBadgeProps {
    permissions: string[];
};

const PermissionBadge: React.FC<PermissionBadgeProps> = ({ permissions }) => {
    if(permissions.includes('*')){
        return (
            <StatusBadge variant='success'>
                All Permissions
            </StatusBadge>
        );
    }
    
    return (
        <Paragraph className='color-secondary font-size-2'>
            {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
        </Paragraph>
    );
};

export default PermissionBadge;
