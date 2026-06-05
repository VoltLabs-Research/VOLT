import Box from '@/shared/presentation/primitives/Box';
import Stack from '@/shared/presentation/primitives/Stack';
import Row from '@/shared/presentation/primitives/Row';
import Modal, { resetModal } from '@/shared/presentation/primitives/Modal';
import { runAction } from '@/shared/presentation/actions/run-action';
import CopyableField from '@/shared/presentation/components/CopyableField';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { useCreateSecretKeyMutation } from '@/modules/team/hooks/secret-key/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamRoleData from '@/modules/team/hooks/role/use-team-role-data';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { useState } from 'react';
import type { FormEvent } from 'react';

export const SECRET_KEY_CREATION_MODAL_ID = 'secret-key-creation-modal';
const SECRET_KEY_CREATION_FORM_ID = 'secret-key-creation-form';

interface SecretKeyCreationModalProps {
    onCreated?: (secretKey: string) => void;
}

interface SecretKeyFormErrors {
    name?: string;
    roleId?: string;
}

const SECRET_KEY_CREATION_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Creating secret key...',
    success: 'Secret key created successfully',
    error: 'Failed to create secret key'
});

export const SecretKeyCreationModal = ({ onCreated }: SecretKeyCreationModalProps) => {
    const selectedTeam = useSelectedTeam();
    const { roles } = useTeamRoleData({ teamId: selectedTeam?._id });
    const createSecretKeyMutation = useCreateSecretKeyMutation();

    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [hasConfirmedCopy, setHasConfirmedCopy] = useState(false);

    const [name, setName] = useState('');
    const [roleId, setRoleId] = useState('');
    const [errors, setErrors] = useState<SecretKeyFormErrors>({});

    const resetState = () => {
        setGeneratedKey(null);
        setHasConfirmedCopy(false);
        setName('');
        setRoleId('');
        setErrors({});
    };

    const closeSecretKeyCreationModal = () => {
        resetModal(SECRET_KEY_CREATION_MODAL_ID, resetState);
    };

    const handleClose = () => {
        if (generatedKey && !hasConfirmedCopy) {
            return;
        }

        closeSecretKeyCreationModal();
    };

    const handleSubmit = async () => {
        const newErrors: SecretKeyFormErrors = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!roleId) newErrors.roleId = 'Role is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        await runAction({
            action: () => {
                if (!selectedTeam?._id) return Promise.resolve();
                return createSecretKeyMutation.mutateAsync({ teamId: selectedTeam._id, name, roleId });
            },
            toast: SECRET_KEY_CREATION_TOAST_OPTIONS,
            afterSuccess: (result) => {
                if (result?.secretKey) {
                    setGeneratedKey(result.secretKey);
                    onCreated?.(result.secretKey);
                }
            }
        });
    };

    const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await handleSubmit();
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
            dismissible={!generatedKey || hasConfirmedCopy}
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
                        disabled: createSecretKeyMutation.isPending
                    }}
                    primary={generatedKey ? {
                        label: 'Done',
                        onClick: handleClose,
                        disabled: !hasConfirmedCopy
                    } : {
                        label: 'Create Key',
                        type: 'submit',
                        form: SECRET_KEY_CREATION_FORM_ID,
                        isLoading: createSecretKeyMutation.isPending
                    }}
                />
            }
        >
            <Box p='1-5'>
                <form id={SECRET_KEY_CREATION_FORM_ID} onSubmit={handleFormSubmit}>
                    <Stack gap='1-5'>
                    {generatedKey ? (
                        <>
                            <CopyableField
                                value={generatedKey}
                                successMessage='Secret key copied to clipboard'
                            />
                            <Row as='label' gap='075' cursor='pointer' className='color-secondary font-size-2'>
                                <input
                                    type='checkbox'
                                    checked={hasConfirmedCopy}
                                    onChange={(event) => setHasConfirmedCopy(event.target.checked)}
                                />
                                <span>I copied or stored this secret key somewhere safe.</span>
                            </Row>
                        </>
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
                    </Stack>
                </form>
            </Box>
        </Modal>
    );
};
