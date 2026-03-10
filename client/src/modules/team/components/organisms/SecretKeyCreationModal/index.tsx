import Container from '@/shared/presentation/components/Container';
import CopyableField from '@/shared/presentation/components/CopyableField';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal from '@/shared/presentation/components/Modal';
import { runHandledAction } from '@/shared/errors/handled-action';
import useCreateSecretKey from '@/modules/team/hooks/secret-key/use-create-secret-key';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamRoleData from '@/modules/team/hooks/role/use-team-role-data';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { useState } from 'react';
import './SecretKeyCreationModal.css';

export const SECRET_KEY_CREATION_MODAL_ID = 'secret-key-creation-modal';

interface SecretKeyCreationModalProps {
    onCreated?: (secretKey: string) => void;
};

interface SecretKeyFormErrors {
    name?: string;
    roleId?: string;
};

const SECRET_KEY_CREATION_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Creating secret key...',
    success: 'Secret key created successfully',
    error: 'Failed to create secret key'
});

export const SecretKeyCreationModal = ({ onCreated }: SecretKeyCreationModalProps) => {
    const selectedTeam = useSelectedTeam();
    const { roles } = useTeamRoleData({ teamId: selectedTeam?._id });
    const { create: createSecretKey, isPending: isCreating } = useCreateSecretKey();

    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [roleId, setRoleId] = useState('');
    const [errors, setErrors] = useState<SecretKeyFormErrors>({});

    const resetState = () => {
        setGeneratedKey(null);
        setName('');
        setRoleId('');
        setErrors({});
    };

    const modalForm = useModalForm({
        modalId: SECRET_KEY_CREATION_MODAL_ID,
        reset: resetState
    });

    const handleClose = () => {
        modalForm.close();
    };

    const handleSubmit = async () => {
        const newErrors: SecretKeyFormErrors = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!roleId) newErrors.roleId = 'Role is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        await runHandledAction({
            action: () => createSecretKey(name, roleId),
            toast: SECRET_KEY_CREATION_TOAST_OPTIONS,
            afterSuccess: (result) => {
                if (result?.secretKey) {
                    setGeneratedKey(result.secretKey);
                    onCreated?.(result.secretKey);
                }
            },
            rethrow: false
        });
    };

    const roleOptions = roles
        .filter((role) => selectedTeam?._id && String(role.team) === String(selectedTeam._id))
        .map((role) => ({
            title: role.name,
            value: role._id
        }));

    return (
        <Modal
            id={SECRET_KEY_CREATION_MODAL_ID}
            title={generatedKey ? 'Secret Key Created' : 'Create Secret Key'}
            description={
                generatedKey
                    ? 'Please copy this secret key and store it securely. You will not be able to see it again.'
                    : 'Create a new secret key to access the VoltLabs API.'
            }
            footer={
                <ModalFooterActions
                    secondary={generatedKey ? undefined : {
                        label: 'Cancel',
                        onClick: handleClose,
                        disabled: isCreating
                    }}
                    primary={generatedKey ? {
                        label: 'Done',
                        onClick: handleClose
                    } : {
                        label: 'Create Key',
                        onClick: handleSubmit,
                        isLoading: isCreating
                    }}
                />
            }
        >
            <Container className='p-1-5'>
                <form className='d-flex column gap-1-5' onSubmit={(e) => e.preventDefault()}>
                    {generatedKey ? (
                        <CopyableField
                            value={generatedKey}
                            successMessage='Secret key copied to clipboard'
                        />
                    ) : (
                        <>
                            <FormFieldRHF
                                label='Key Name'
                                placeholder='e.g., Production API Key'
                                error={errors.name}
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors({ ...errors, name: undefined });
                                }}
                            />

                            <FormFieldRHF
                                fieldType='select'
                                variant='inline'
                                label='Role'
                                options={roleOptions}
                                placeholder={roleOptions.length ? 'Select a role...' : 'No roles for selected team'}
                                error={errors.roleId}
                                value={roleId}
                                onChange={(e) => {
                                    setRoleId(e.target.value);
                                    if (errors.roleId) setErrors({ ...errors, roleId: undefined });
                                }}
                            />
                        </>
                    )}
                </form>
            </Container>
        </Modal>
    );
};
