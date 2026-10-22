import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Alert, Checkbox } from '@heroui/react';
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
            <Scrollable className='flex flex-col gap-5 max-h-[70vh]'>
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
                <fieldset className='flex flex-col gap-2 border-0 m-0 p-0 min-w-0'>
                    <legend className='mb-1.5 p-0 text-base font-medium text-foreground'>Permissions</legend>
                    <Scrollable orientation='horizontal'>
                        <div className='grid min-w-[30rem] grid-cols-[minmax(7rem,10rem)_repeat(4,minmax(3.5rem,1fr))] items-center text-sm [&>*]:border-b [&>*]:border-foreground/6 [&>*:nth-last-child(-n+5)]:border-b-0'>
                            <div className='p-2 text-2xs font-medium uppercase tracking-[0.06em] text-muted'>Resource</div>
                            {actions.map((action) => (
                                <div className='p-2 text-center text-2xs font-medium uppercase tracking-[0.06em] text-muted' key={action.key}>
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
                                            className='h-full rounded-md p-2 text-left font-medium text-foreground underline-offset-2 decoration-foreground/15 enabled:hover:underline disabled:cursor-default'
                                            onClick={() => handleToggleResourceAll(resource.key)}
                                            disabled={isSystemRole}
                                            aria-pressed={areAllPermissionsChecked}
                                            title={isSystemRole ? 'System permissions are read-only' : `Toggle all permissions for ${resource.label}`}
                                        >
                                            {resource.label}
                                        </button>
                                        {actions.map((action) => (
                                            <div key={`${resource.key}-${action.key}`} className='flex h-full items-center justify-center p-2'>
                                                <Checkbox
                                                    isSelected={isPermissionChecked(resource.key, action.key)}
                                                    onChange={() => handleTogglePermission(resource.key, action.key)}
                                                    isDisabled={isSystemRole || hasWildcard}
                                                    aria-label={`${action.label} permission for ${resource.label}`}
                                                >
                                                    <Checkbox.Control>
                                                        <Checkbox.Indicator />
                                                    </Checkbox.Control>
                                                </Checkbox>
                                            </div>
                                        ))}
                                    </Fragment>
                                );
                            })}
                        </div>
                    </Scrollable>
                </fieldset>
            </Scrollable>
        </Modal>
    );
};

export const openRoleEditorModal = () => {
    openModal(MODAL_ID);
};
