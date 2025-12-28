import React, { useState, useEffect, useCallback, act } from 'react';
import { IoWarningOutline } from 'react-icons/io5';
import { RESOURCES, ACTIONS, getPermission, hasPermission, type ResourceKey, type ActionKey } from '@/constants/permissions';
import type { TeamRole, TeamRolePayload } from '@/types/team-role';
import Button from '@/components/primitives/Button';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Modal from '@/components/molecules/common/Modal';
import FormInput from '@/components/atoms/form/FormInput';
import './RoleEditor.css';

interface RoleEditorProps {
    role?: TeamRole | null;
    onSave: (data: TeamRolePayload) => Promise<void>;
    isSaving?: boolean;
};

const RoleEditor = ({ role, onSave, isSaving = false }: RoleEditorProps) => {
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState<Set<string>>(new Set());

    const isEditing = !!role;
    const isSystemRole = role?.isSystem ?? false;
    const hasWildcard = role?.permissions.includes('*') ?? false;

    useEffect(() => {
        if (role) {
            setName(role.name);
            setPermissions(new Set(role.permissions));
        }

        return () => {
            setName('');
            setPermissions(new Set());
        };
    }, [role]);

    const handleTogglePermission = useCallback((resource: ResourceKey, action: ActionKey) => {
        if (isSystemRole) return;

        const permission = getPermission(resource, action);
        setPermissions((prev) => {
            const next = new Set(prev);
            if (next.has(permission)) {
                next.delete(permission);
            } else {
                next.add(permission);
            }
            return next;
        });
    }, [isSystemRole]);

    const handleToggleResourceAll = useCallback((resource: ResourceKey) => {
        if (isSystemRole) return;

        const resourcePermissions = ACTIONS.map((action) => getPermission(resource, action.key));
        const allChecked = resourcePermissions.every((permission) => permissions.has(permission));

        setPermissions((prev) => {
            const next = new Set(prev);
            if (allChecked) {
                resourcePermissions.forEach((permission) => next.delete(permission));
            } else {
                resourcePermissions.forEach((permission) => next.add(permission));
            }
            return next;
        });
    }, [isSystemRole, permissions]);

    const closeModal = () => {
        (document.getElementById('role-editor-modal') as HTMLDialogElement)?.close();
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;

        await onSave({
            name: name.trim(),
            permissions: Array.from(permissions)
        });

        closeModal();
    };

    const isPermissionChecked = useCallback((resource: ResourceKey, action: ActionKey): boolean => {
        if (hasWildcard) return true;
        return hasPermission(Array.from(permissions), resource, action);
    }, [permissions, hasWildcard]);

    const footer = (
        <>
            <Button
                variant="ghost"
                intent="neutral"
                commandfor='role-editor-modal'
                command="close"
                disabled={isSaving}
            >
                {isSystemRole ? 'Close' : 'Cancel'}
            </Button>
            {!isSystemRole && (
                <Button
                    variant="solid"
                    intent="brand"
                    onClick={handleSubmit}
                    disabled={isSaving || !name.trim()}
                    isLoading={isSaving}
                >
                    {isEditing ? 'Save Changes' : 'Create Role'}
                </Button>
            )}
        </>
    );

    return (
        <Modal
            id='role-editor-modal'
            title={isEditing ? (isSystemRole ? 'View Role' : 'Edit Role') : 'Create New Role'}
            width='720px'
            className='role-editor-modal p-1'
            footer={footer}
        >
            <Container className='p-2 d-flex column gap-2'>
                <Container className='d-flex column gap-1'>
                    {isSystemRole && (
                        <div className='d-flex items-center gap-05'>
                            <IoWarningOutline size={18} />
                            <span>System roles cannot be modified. You can only view their permissions.</span>
                        </div>
                    )}

                    <FormInput
                        label='Role Name'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder='Enter role name...'
                        disabled={isSystemRole}
                        autoFocus={!isEditing}
                    />
                </Container>
      
                {/* Permissions Grid */}
                <Container className="d-flex column gap-1">
                    <Title className="font-size-3 color-text-secondary font-weight-6">Permissions</Title>

                    <Container className="role-editor-permissions-grid">
                        {/* Header Row */}
                        <div className="role-editor-grid-header">Resource</div>
                        {ACTIONS.map(action => (
                            <div key={action.key} className="role-editor-grid-header">
                                {action.label}
                            </div>
                        ))}

                        {/* Resource Rows */}
                        {RESOURCES.map(resource => (
                            <React.Fragment key={resource.key}>
                                <div
                                    className="role-editor-grid-resource"
                                    onClick={() => !isSystemRole && handleToggleResourceAll(resource.key)}
                                    style={{ cursor: isSystemRole ? 'default' : 'pointer' }}
                                    title={isSystemRole ? undefined : 'Click to toggle all'}
                                >
                                    {resource.label}
                                </div>
                                {ACTIONS.map(action => (
                                    <div key={`${resource.key}-${action.key}`} className="role-editor-grid-cell">
                                        <input
                                            type="checkbox"
                                            checked={isPermissionChecked(resource.key, action.key)}
                                            onChange={() => handleTogglePermission(resource.key, action.key)}
                                            disabled={isSystemRole || hasWildcard}
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                cursor: isSystemRole || hasWildcard ? 'not-allowed' : 'pointer',
                                                accentColor: 'var(--accent-blue)'
                                            }}
                                        />
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </Container>
                </Container>
            </Container>
        </Modal>
    );
};

export default RoleEditor;

export const openRoleEditorModal = () => {
    (document.getElementById('role-editor-modal') as HTMLDialogElement)?.showModal();
};