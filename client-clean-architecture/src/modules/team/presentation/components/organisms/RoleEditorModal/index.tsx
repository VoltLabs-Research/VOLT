import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormField from '@/shared/presentation/components/FormField';
import Container from '@/shared/presentation/components/Container';
import WarningZone from '@/shared/presentation/components/WarningZone';
import RolePermissionGrid, { RBACResource } from '../../molecules/RolePermissionGrid';
import ModalFooter from '../../molecules/ModalFooter';
import useForm from '@/shared/presentation/hooks/use-form';
import usePermissions, { type RBACAction } from '../../../hooks/team-role/use-permissions';
import { roleEditorSchema, RoleEditorForm } from './validation-schema';
import type { TeamRole } from '@/modules/team/domain/entities/TeamRole';
import './RoleEditorModal.css';

const MODAL_ID = 'role-editor-modal';

export interface RoleEditorPayload {
    name: string;
    permissions: string[];
};

interface RoleEditorModalProps {
    role?: TeamRole | null;
    resources: RBACResource[];
    actions: RBACAction[];
    onSave: (data: RoleEditorPayload) => Promise<void>;
    isSaving?: boolean;
};

const RoleEditorModal: React.FC<RoleEditorModalProps> = ({
    role,
    resources,
    actions,
    onSave,
    isSaving = false
}) => {
    const isEditing = !!role;
    const isSystemRole = role?.isSystem ?? false;
    const hasWildcard = role?.permissions.includes('*') ?? false;

    const { field, values, reset } = useForm<RoleEditorForm>({
        initialValues: { name: '' },
        schema: roleEditorSchema
    });

    const {
        permissions,
        resetPermissions,
        togglePermission,
        toggleResourceAll,
        toArray
    } = usePermissions({
        actions,
        disabled: isSystemRole
    });

    useEffect(() => {
        if(role) {
            reset({ name: role.name });
            resetPermissions(role.permissions);
        } else {
            reset({ name: '' });
            resetPermissions();
        }
    }, [role, reset, resetPermissions]);

    const handleSubmit = async () => {
        if(!values.name.trim()) return;

        await onSave({
            name: values.name.trim(),
            permissions: toArray()
        });

        closeModal(MODAL_ID);
    };

    const handleClose = () => closeModal(MODAL_ID);

    const nameField = field('name');

    return (
        <Modal
            id={MODAL_ID}
            title={isEditing ? (isSystemRole ? 'View Role' : 'Edit Role') : 'Create New Role'}
            width='720px'
            footer={(
                <ModalFooter
                    onCancel={handleClose}
                    onSubmit={handleSubmit}
                    cancelLabel={isSystemRole ? 'Close' : 'Cancel'}
                    submitLabel={isEditing ? 'Save Changes' : 'Create Role'}
                    isSubmitting={isSaving}
                    isSubmitDisabled={!values.name.trim()}
                    showSubmit={!isSystemRole}
                />
            )}
        >
            <Container className='p-1-5 d-flex column gap-1-5'>
                {isSystemRole && (
                    <WarningZone
                        icon={<AlertTriangle size={18} />}
                        message='System roles cannot be modified. You can only view their permissions.'
                    />
                )}

                <FormField
                    label='Role Name'
                    value={nameField.value}
                    onChange={nameField.onChange}
                    onBlur={nameField.onBlur}
                    error={nameField.error}
                    placeholder='Enter role name...'
                    disabled={isSystemRole}
                    autoFocus={!isEditing}
                />

                <RolePermissionGrid
                    resources={resources}
                    actions={actions}
                    permissions={permissions}
                    onTogglePermission={togglePermission}
                    onToggleResourceAll={toggleResourceAll}
                    disabled={isSystemRole}
                    hasWildcard={hasWildcard}
                />
            </Container>
        </Modal>
    );
};

export default RoleEditorModal;

export const openRoleEditorModal = () => {
    (document.getElementById(MODAL_ID) as HTMLDialogElement)?.showModal();
};
