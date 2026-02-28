import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { MdContentCopy, MdCheck } from 'react-icons/md';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { showSuccess, showPromise } from '@/shared/presentation/hooks/toast';
import useCreateSecretKey from '@/modules/team/presentation/hooks/secret-key/use-create-secret-key';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTeamRoleData from '@/modules/team/presentation/hooks/team-role/use-team-role-data';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import './SecretKeyCreationModal.css';

export const SECRET_KEY_CREATION_MODAL_ID = 'secret-key-creation-modal';

interface CreateSecretKeyFormData {
    name: string;
    roleId: string;
}

interface SecretKeyCreationModalProps {
    onCreated?: (secretKey: string) => void;
}

const SecretKeyCreationModal: React.FC<SecretKeyCreationModalProps> = ({ onCreated }) => {
    const { fetchRoles } = useTeamRoleData();
    const roles = useTeamRoleStore((state) => state.roles);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const createSecretKey = useCreateSecretKey();

    const [isLoading, setIsLoading] = useState(false);
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateSecretKeyFormData>({
        defaultValues: {
            name: '',
            roleId: ''
        }
    });

    useEffect(() => {
        if (selectedTeam?._id) {
            fetchRoles(selectedTeam._id).catch(console.error);
        }
    }, [selectedTeam?._id, fetchRoles]);

    const handleCopy = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            showSuccess({ title: 'Secret key copied to clipboard' });
        }
    };

    const handleClose = () => {
        closeModal(SECRET_KEY_CREATION_MODAL_ID);
        setTimeout(() => {
            setGeneratedKey(null);
            reset();
        }, 300);
    };

    const onSubmit = async (data: CreateSecretKeyFormData) => {
        try {
            setIsLoading(true);
            const response = await showPromise(
                createSecretKey(data.name, data.roleId),
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
        } finally {
            setIsLoading(false);
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
                        <Button variant='ghost' intent='neutral' onClick={handleClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button variant='solid' intent='brand' onClick={handleSubmit(onSubmit)} isLoading={isLoading}>
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
                            <Controller
                                name='name'
                                control={control}
                                rules={{ required: 'Name is required' }}
                                render={({ field }) => (
                                    <FormField
                                        label='Key Name'
                                        placeholder='e.g., Production API Key'
                                        error={errors.name?.message}
                                        {...field}
                                    />
                                )}
                            />
                            
                            <Controller
                                name='roleId'
                                control={control}
                                rules={{ required: 'Role is required' }}
                                render={({ field }) => (
                                    <FormField
                                        fieldType='select'
                                        variant='inline'
                                        label='Role'
                                        options={roleOptions}
                                        placeholder={roleOptions.length ? 'Select a role...' : 'No roles for selected team'}
                                        error={errors.roleId?.message}
                                        {...field}
                                    />
                                )}
                            />
                        </>
                    )}
                </form>
            </Container>
        </Modal>
    );
};

export default SecretKeyCreationModal;
