import React, { useState } from 'react';
import { MdContentCopy, MdCheck } from 'react-icons/md';
import Modal from '@/shared/presentation/components/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import useCreateSecretKey from '@/modules/team/hooks/secret-key/use-create-secret-key';
import useTeamRoleData from '@/modules/team/hooks/team-role/use-team-role-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import ApiError from '@/shared/errors/ApiError';
import './SecretKeyCreationModal.css';

export const SECRET_KEY_CREATION_MODAL_ID = 'secret-key-creation-modal';

interface SecretKeyCreationModalProps {
    onCreated?: (secretKey: string) => void;
}

const SecretKeyCreationModal: React.FC<SecretKeyCreationModalProps> = ({ onCreated }) => {
    const selectedTeam = useSelectedTeam();
    const { roles } = useTeamRoleData({ teamId: selectedTeam?._id });
    const { create: createSecretKey, isPending: isCreating } = useCreateSecretKey();

    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const [name, setName] = useState('');
    const [roleId, setRoleId] = useState('');
    const [errors, setErrors] = useState<{ name?: string; roleId?: string }>({});

    const resetState = () => {
        setGeneratedKey(null);
        setName('');
        setRoleId('');
        setErrors({});
        setCopied(false);
    };

    const modalForm = useModalForm({
        modalId: SECRET_KEY_CREATION_MODAL_ID,
        reset: resetState
    });

    const handleCopy = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            sileo.success({ title: 'Secret key copied to clipboard' });
        }
    };

    const handleClose = () => {
        modalForm.close();
    };

    const handleSubmit = async () => {
        const newErrors: { name?: string; roleId?: string } = {};
        if (!name.trim()) newErrors.name = 'Name is required';
        if (!roleId) newErrors.roleId = 'Role is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            const response = await showPromise(
                createSecretKey(name, roleId),
                {
                    loading: { title: 'Creating secret key...' },
                    success: { title: 'Secret key created successfully' },
                    error: { title: 'Failed to create secret key' }
                }
            );
            if (response?.secretKey) {
                setGeneratedKey(response.secretKey);
                onCreated?.(response.secretKey);
            }
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
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
                generatedKey ? (
                    <Button variant='solid' intent='brand' onClick={handleClose}>
                        Done
                    </Button>
                ) : (
                    <>
                        <Button variant='ghost' intent='neutral' onClick={handleClose} disabled={isCreating}>
                            Cancel
                        </Button>
                        <Button variant='solid' intent='brand' onClick={handleSubmit} isLoading={isCreating}>
                            Create Key
                        </Button>
                    </>
                )
            }
        >
            <Container className='p-1-5'>
                <form className='d-flex column gap-1-5' onSubmit={(e) => e.preventDefault()}>
                    {generatedKey ? (
                        <Container className='p-1-5 secret-key-creation-modal-preview'>
                            <Container className='d-flex items-center content-between gap-1'>
                                <Paragraph className='color-primary secret-key-creation-modal-key-value'>
                                    {generatedKey}
                                </Paragraph>
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    onClick={handleCopy}
                                    leftIcon={copied ? <MdCheck className="secret-key-creation-modal-copy-success" /> : <MdContentCopy />}
                                    aria-label="Copy secret key"
                                />
                            </Container>
                        </Container>
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

export default SecretKeyCreationModal;
