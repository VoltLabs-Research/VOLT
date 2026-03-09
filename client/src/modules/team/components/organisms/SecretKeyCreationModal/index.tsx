import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import CopyableField from '@/shared/presentation/components/CopyableField';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal from '@/shared/presentation/components/Modal';
import useCreateSecretKey from '@/modules/team/hooks/secret-key/use-create-secret-key';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamRoleData from '@/modules/team/hooks/role/use-team-role-data';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useState } from 'react';
import './SecretKeyCreationModal.css';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';

export const SECRET_KEY_CREATION_MODAL_ID = 'secret-key-creation-modal';

interface SecretKeyCreationModalProps {
    onCreated?: (secretKey: string) => void;
};

interface SecretKeyFormErrors {
    name?: string;
    roleId?: string;
};

interface PromiseToastOptions {
    loading: { title: string };
    success: { title: string };
    error: { title: string };
};

const SECRET_KEY_CREATION_TOAST_OPTIONS: PromiseToastOptions = {
    loading: { title: 'Creating secret key...' },
    success: { title: 'Secret key created successfully' },
    error: { title: 'Failed to create secret key' }
};

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

        try {
            const response = await showPromise(
                createSecretKey(name, roleId),
                SECRET_KEY_CREATION_TOAST_OPTIONS
            );
            if (response?.secretKey) {
                setGeneratedKey(response.secretKey);
                onCreated?.(response.secretKey);
            }
        } catch(error: unknown) {
            if(isAccessDeniedError(error)) return;
        }
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
