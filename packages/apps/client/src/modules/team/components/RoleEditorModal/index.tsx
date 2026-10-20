import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Alert } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal, openModal } from '@/shared/ui/modal/use-modal-store';
import { runAction } from '@/shared/ui/actions/run-action';
import type { TeamRole } from '@volt/contracts/modules/team/domain';
import type { RbacEntry } from '@volt/contracts/modules/system/domain';
import { TriangleAlert } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

import type { RoleEditorPayload } from '@/modules/team/contracts/role-editor';

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
            footer={footer}
        >
            <Scrollable className='flex flex-col gap-8 p-8 max-h-[70vh]'>
                {isSystemRole && (

                    <Alert status='warning' role='status' aria-live='polite'>
                        <Alert.Indicator>
                            <TriangleAlert size={18} aria-hidden='true' />
                        </Alert.Indicator>
                        <Alert.Content>
                            <Alert.Description>
                                System roles cannot be modified. You can only view their permissions.
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>
                )}

                <FormFieldRHF
                    label='Role Name'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='Enter role name...'
                    disabled={isSystemRole}
                    autoFocus={!isEditing}
                />
                <fieldset className='flex flex-col gap-4 border-0 m-0 p-0 min-w-0'>
                    <legend className='p-0'>
                        <h3 className='text-base font-semibold text-muted'>Permissions</h3>
                    </legend>
                    <div className='grid grid-cols-[160px_repeat(4,1fr)] gap-0 max-md:grid-cols-[120px_repeat(4,1fr)]'>
                        <div className='p-2 text-sm font-semibold normal-case tracking-normal text-foreground border-b-2 border-border mb-1 text-left'>Resource</div>
                        {actions.map((action) => (
                            <div className='p-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted border-b-2 border-border mb-1 text-center' key={action.key}>
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
                                        className='flex items-center py-2.5 px-0 min-h-11 text-left bg-transparent border-0 border-b border-border text-sm font-medium text-foreground max-md:p-2 max-md:text-xs [&:nth-last-child(-n+5)]:border-b-0'
                                        onClick={() => handleToggleResourceAll(resource.key)}
                                        disabled={isSystemRole}
                                        aria-pressed={areAllPermissionsChecked}
                                        title={isSystemRole ? 'System permissions are read-only' : `Toggle all permissions for ${resource.label}`}
                                    >
                                        {resource.label}
                                    </button>
                                    {actions.map((action) => (
                                        <div key={`${resource.key}-${action.key}`} className='flex items-center justify-center px-2 py-2.5 border-b border-border max-md:p-2 max-md:text-xs [&:nth-last-child(-n+5)]:border-b-0'>
                                            <input
                                                type='checkbox'
                                                checked={isPermissionChecked(resource.key, action.key)}
                                                onChange={() => handleTogglePermission(resource.key, action.key)}
                                                disabled={isSystemRole || hasWildcard}
                                                className='size-[18px] cursor-pointer accent-accent disabled:cursor-not-allowed'
                                                aria-label={`${action.label} permission for ${resource.label}`}
                                            />
                                        </div>
                                    ))}
                                </Fragment>
                            );
                        })}
                    </div>
                </fieldset>
            </Scrollable>
        </Modal>
    );
};

export const openRoleEditorModal = () => {
    openModal(MODAL_ID);
};
