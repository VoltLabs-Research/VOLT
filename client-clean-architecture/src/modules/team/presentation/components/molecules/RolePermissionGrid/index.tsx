import React, { useCallback } from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { checkPermission, type RBACAction } from '../../../hooks/team-role/use-permissions';
import './RolePermissionGrid.css';

export interface RBACResource {
    key: string;
    label: string;
};

export type { RBACAction };

interface RolePermissionGridProps {
    resources: RBACResource[];
    actions: RBACAction[];
    permissions: Set<string>;
    onTogglePermission: (resourceKey: string, actionKey: string) => void;
    onToggleResourceAll: (resourceKey: string) => void;
    disabled?: boolean;
    hasWildcard?: boolean;
};

const RolePermissionGrid: React.FC<RolePermissionGridProps> = ({
    resources,
    actions,
    permissions,
    onTogglePermission,
    onToggleResourceAll,
    disabled = false,
    hasWildcard = false
}) => {
    const isPermissionChecked = useCallback((resourceKey: string, actionKey: string): boolean => {
        if(hasWildcard) return true;
        return checkPermission(permissions, resourceKey, actionKey);
    }, [permissions, hasWildcard]);

    const handleToggleResource = (resourceKey: string) => {
        if(!disabled) {
            onToggleResourceAll(resourceKey);
        }
    };

    const handleTogglePermission = (resourceKey: string, actionKey: string) => {
        if(!disabled && !hasWildcard) {
            onTogglePermission(resourceKey, actionKey);
        }
    };

    return (
        <Container className='d-flex column gap-1'>
            <Title className='font-size-3 color-text-secondary font-weight-6'>Permissions</Title>

            <Container className='role-permission-grid'>
                <Container className='role-permission-grid-header text-center font-size-1 font-weight-6 color-secondary'>
                    Resource
                </Container>
                {actions.map(action => (
                    <Container 
                        key={action.key} 
                        className='role-permission-grid-header text-center font-size-1 font-weight-6 color-secondary'
                    >
                        {action.label}
                    </Container>
                ))}

                {resources.map(resource => (
                    <React.Fragment key={resource.key}>
                        <Container
                            className='role-permission-grid-resource font-size-2 font-weight-5 color-primary'
                            onClick={() => handleToggleResource(resource.key)}
                            style={{ cursor: disabled ? 'default' : 'pointer' }}
                            title={disabled ? undefined : 'Click to toggle all'}
                        >
                            {resource.label}
                        </Container>
                        {actions.map(action => (
                            <Container 
                                key={`${resource.key}-${action.key}`} 
                                className='role-permission-grid-cell d-flex flex-center'
                            >
                                <input
                                    type='checkbox'
                                    checked={isPermissionChecked(resource.key, action.key)}
                                    onChange={() => handleTogglePermission(resource.key, action.key)}
                                    disabled={disabled || hasWildcard}
                                    className='role-permission-checkbox'
                                />
                            </Container>
                        ))}
                    </React.Fragment>
                ))}
            </Container>
        </Container>
    );
};

export default RolePermissionGrid;
