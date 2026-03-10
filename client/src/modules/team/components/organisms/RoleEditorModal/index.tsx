import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import { runAction } from '@/shared/presentation/actions/run-action';
import Title from '@/shared/presentation/components/Title';
import WarningZone from '@/shared/presentation/components/WarningZone';
import type { TeamRole } from '@/modules/team/api/entities/role/team-role';
import type { RBACAction, RBACResource } from '@/modules/system/api/entities/rbac';
import { IoWarningOutline } from 'react-icons/io5';
import { Fragment } from 'react';
import { useCallback, useEffect, useState } from 'react';
import './RoleEditorModal.css';

export type { RBACResource, RBACAction };

export interface RoleEditorPayload {
    name: string;
    permissions: string[];
};

export interface RoleEditorModalProps {
    role?: TeamRole | null;
    resources: RBACResource[];
    actions: RBACAction[];
    onSave: (data: RoleEditorPayload) => Promise<void>;
    isSaving?: boolean;
};

const MODAL_ID = 'role-editor-modal';

export const RoleEditorModal = ({
    role,
    resources,
    actions,
    onSave,
    isSaving = false
}: RoleEditorModalProps) => {
    const [name, setName] = useState('');
    const [permissions, setPermissions] = useState<Set<string>>(new Set());

    const isEditing = !!role;
    const isSystemRole = role?.isSystem ?? false;
    const hasWildcard = role?.permissions.includes('*') ?? false;

    useEffect(() => {
        if(role){
            setName(role.name);
            setPermissions(new Set(role.permissions));
        }else{
            setName('');
            setPermissions(new Set());
        }
    }, [role]);

    const getPermission = (resource: string, action: string) => `${resource}:${action}`;

    const isPermissionChecked = useCallback((resourceKey: string, actionKey: string): boolean => {
        if(hasWildcard) return true;
        return permissions.has(getPermission(resourceKey, actionKey));
    }, [permissions, hasWildcard]);

    const handleTogglePermission = useCallback((resourceKey: string, actionKey: string) => {
        if(isSystemRole) return;

        const permission = getPermission(resourceKey, actionKey);
        setPermissions((prev) => {
            const next = new Set(prev);
            if(next.has(permission)){
                next.delete(permission);
            }else{
                next.add(permission);
            }
            return next;
        });
    }, [isSystemRole]);

    const handleToggleResourceAll = useCallback((resourceKey: string) => {
        if(isSystemRole) return;

        const resourcePermissions = actions.map((action) => getPermission(resourceKey, action.key));
        const allChecked = resourcePermissions.every(permissions.has, permissions);

        setPermissions((prev) => {
            const next = new Set(prev);
            if(allChecked){
                resourcePermissions.forEach(next.delete, next);
            }else{
                resourcePermissions.forEach(next.add, next);
            }
            return next;
        });
    }, [isSystemRole, permissions, actions]);

    const handleSubmit = async () => {
        if(!name.trim()) return;

        await runAction({
            action: () => onSave({
                name: name.trim(),
                permissions: Array.from(permissions)
            }),
            modalId: MODAL_ID
        });
    };

    const footer = (
        <ModalFooterActions
            secondary={{
                label: isSystemRole ? 'Close' : 'Cancel',
                onClick: () => closeModal(MODAL_ID),
                disabled: isSaving
            }}
            primary={isSystemRole ? undefined : {
                label: isEditing ? 'Save Changes' : 'Create Role',
                onClick: handleSubmit,
                disabled: isSaving || !name.trim(),
                isLoading: isSaving
            }}
        />
    );

    return (
        <Modal
            id={MODAL_ID}
            title={isEditing ? (isSystemRole ? 'View Role' : 'Edit Role') : 'Create New Role'}
            width='720px'
            className='role-editor-modal'
            footer={footer}
        >
            <Container className='p-2 d-flex column gap-2'>
                {isSystemRole && (
                    <WarningZone
                        icon={<IoWarningOutline size={18} />}
                        message='System roles cannot be modified. You can only view their permissions.'
                    />
                )}

                <FormFieldRHF
                    label='Role Name'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='Enter role name...'
                    disabled={isSystemRole}
                    autoFocus={!isEditing}
                />

                <Container className='d-flex column gap-1'>
                    <Title className='font-size-3 color-secondary font-weight-6'>Permissions</Title>

                    <Container className='role-editor-permissions-grid'>
                        <Container className='role-editor-grid-header'>Resource</Container>
                        {actions.map(action => (
                            <Container key={action.key} className='role-editor-grid-header text-center'>
                                {action.label}
                            </Container>
                        ))}

                        {resources.map(resource => (
                            <Fragment key={resource.key}>
                                <Container
                                    className='role-editor-grid-resource font-size-2 font-weight-5 color-primary'
                                    onClick={() => !isSystemRole && handleToggleResourceAll(resource.key)}
                                    style={{ cursor: isSystemRole ? 'default' : 'pointer' }}
                                    title={isSystemRole ? undefined : 'Click to toggle all'}
                                >
                                    {resource.label}
                                </Container>
                                {actions.map(action => (
                                    <Container key={`${resource.key}-${action.key}`} className='role-editor-grid-cell'>
                                        <input
                                            type='checkbox'
                                            checked={isPermissionChecked(resource.key, action.key)}
                                            onChange={() => handleTogglePermission(resource.key, action.key)}
                                            disabled={isSystemRole || hasWildcard}
                                            className='role-editor-checkbox'
                                        />
                                    </Container>
                                ))}
                            </Fragment>
                        ))}
                    </Container>
                </Container>
            </Container>
        </Modal>
    );
};

export const openRoleEditorModal = () => {
    openModal(MODAL_ID);
};
