import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Modal, closeModal, openModal, Callout } from '@voltstack/bravais';
import { runAction } from '@/shared/ui/actions/run-action';
import type { TeamRole } from '@volt/contracts/modules/team/domain';
import type { RbacEntry } from '@volt/contracts/modules/system/domain';
import { TriangleAlert } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import './RoleEditorModal.css';

export interface RoleEditorPayload {
    name: string;
    permissions: string[];
}

interface RoleEditorModalProps {
    role?: TeamRole | null;
    resources: RbacEntry[];
    actions: RbacEntry[];
    onSave: (data: RoleEditorPayload) => Promise<void>;
    isSaving?: boolean;
}

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
        if (role) {
            setName(role.name);
            setPermissions(new Set(role.permissions));
        } else {
            setName('');
            setPermissions(new Set());
        }
    }, [role]);

    const getPermission = (resource: string, action: string) => `${resource}:${action}`;

    const isPermissionChecked = (resourceKey: string, actionKey: string): boolean => {
        if (hasWildcard) return true;
        return permissions.has(getPermission(resourceKey, actionKey));
    };

    const handleTogglePermission = (resourceKey: string, actionKey: string) => {
        if (isSystemRole) return;

        const permission = getPermission(resourceKey, actionKey);
        setPermissions((prev) => {
            const next = new Set(prev);
            if (next.has(permission)) {
                next.delete(permission);
            } else {
                next.add(permission);
            }
            return next;
        });
    };

    const handleToggleResourceAll = (resourceKey: string) => {
        if (isSystemRole) return;

        const resourcePermissions = actions.map((action) => getPermission(resourceKey, action.key));
        const allChecked = resourcePermissions.every(permissions.has, permissions);

        setPermissions((prev) => {
            const next = new Set(prev);
            if (allChecked) {
                resourcePermissions.forEach(next.delete, next);
            } else {
                resourcePermissions.forEach(next.add, next);
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;

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
                onPress: () => closeModal(MODAL_ID),
                isDisabled: isSaving
            }}
            primary={isSystemRole ? undefined : {
                label: isEditing ? 'Save Changes' : 'Create Role',
                onPress: handleSubmit,
                isDisabled: isSaving || !name.trim(),
                isPending: isSaving
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
            <div className='flex flex-col gap-8 p-8'>
                {isSystemRole && (
                    <Callout
                        tone='warning'
                        icon={<TriangleAlert size={18} />}
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

                <fieldset className='role-editor-fieldset flex flex-col gap-4'>
                    <legend className='role-editor-legend'>
                        <h3 className='text-base font-semibold text-muted'>Permissions</h3>
                    </legend>

                    <div className='role-editor-permissions-grid'>
                        <div className='role-editor-grid-header'>Resource</div>
                        {actions.map((action) => (
                            <div className='text-center role-editor-grid-header' key={action.key}>
                                {action.label}
                            </div>
                        ))}

                        {resources.map((resource) => {
                            const resourcePermissions = actions.map((action) => getPermission(resource.key, action.key));
                            const areAllPermissionsChecked = resourcePermissions.every(permissions.has, permissions);

                            return (
                                <Fragment key={resource.key}>
                                    <button
                                        type='button'
                                        className='role-editor-grid-resource text-sm font-medium text-foreground'
                                        onClick={() => handleToggleResourceAll(resource.key)}
                                        disabled={isSystemRole}
                                        aria-pressed={areAllPermissionsChecked}
                                        title={isSystemRole ? 'System permissions are read-only' : `Toggle all permissions for ${resource.label}`}
                                    >
                                        {resource.label}
                                    </button>
                                    {actions.map((action) => (
                                        <div key={`${resource.key}-${action.key}`} className='role-editor-grid-cell'>
                                            <input
                                                type='checkbox'
                                                checked={isPermissionChecked(resource.key, action.key)}
                                                onChange={() => handleTogglePermission(resource.key, action.key)}
                                                disabled={isSystemRole || hasWildcard}
                                                className='role-editor-checkbox'
                                                aria-label={`${action.label} permission for ${resource.label}`}
                                            />
                                        </div>
                                    ))}
                                </Fragment>
                            );
                        })}
                    </div>
                </fieldset>
            </div>
        </Modal>
    );
};

export const openRoleEditorModal = () => {
    openModal(MODAL_ID);
};
