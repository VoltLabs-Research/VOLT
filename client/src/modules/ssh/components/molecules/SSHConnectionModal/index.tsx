import { useCreateSSHConnectionMutation, useUpdateSSHConnectionMutation } from '@/modules/ssh/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createSSHConnectionSchema, defaultValues } from '@/modules/ssh/utilities/ssh-connection-form-schema';
import SSHConnectionTestButton from '@/modules/ssh/components/atoms/SSHConnectionTestButton';
import SSHConnectionForm from '@/modules/ssh/components/molecules/SSHConnectionForm';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal from '@/shared/presentation/components/Modal';
import useModalForm from '@/shared/presentation/hooks/use-modal-form';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import { useEffect } from 'react';
import type { CreateSSHConnectionParams } from '@/modules/ssh/api/dtos/create-ssh-connection';
import type { SSHConnection } from '@/modules/ssh/api/entities/ssh-connection';
import type { UpdateSSHConnectionParams } from '@/modules/ssh/api/dtos/update-ssh-connection';
import type { SSHConnectionFormData } from '@/modules/ssh/utilities/ssh-connection-form-schema';

export const SSH_CONNECTION_MODAL_ID = 'ssh-connection-modal';
const SSH_CONNECTION_FORM_ID = 'ssh-connection-form';

interface SSHConnectionModalProps {
    connection: SSHConnection | null;
    mode: 'create' | 'edit';
    onSuccess?: () => void;
};

const SSHConnectionModal = ({ connection, mode, onSuccess }: SSHConnectionModalProps) => {
    const createConnection = useCreateSSHConnectionMutation();
    const updateConnection = useUpdateSSHConnectionMutation();
    const form = useZodForm<SSHConnectionFormData>({
        schema: createSSHConnectionSchema(mode),
        defaultValues
    });

    const modalForm = useModalForm({
        modalId: SSH_CONNECTION_MODAL_ID,
        reset: () => form.reset(defaultValues)
    });

    useEffect(() => {
        if (mode === 'edit' && connection) {
            form.reset({
                name: connection.name,
                host: connection.host,
                port: String(connection.port),
                username: connection.username,
                password: ''
            });
        } else {
            form.reset(defaultValues);
        }
    }, [mode, connection]);

    const onSubmit = async (values: SSHConnectionFormData) => {
        const port = parseInt(values.port);

        const action = async () => {
            if (mode === 'create') {
                const params: CreateSSHConnectionParams = {
                    name: values.name,
                    host: values.host,
                    port,
                    username: values.username,
                    password: values.password
                };
                await createConnection.mutateAsync(params);
            } else if (connection) {
                const params: UpdateSSHConnectionParams = {
                    name: values.name,
                    host: values.host,
                    port,
                    username: values.username
                };
                if (values.password.trim()) {
                    params.password = values.password;
                }
                await updateConnection.mutateAsync({
                    sshConnectionId: connection._id,
                    ...params
                });
            }
        };

        await showPromise(action(), {
            loading: { title: mode === 'create' ? 'Creating connection...' : 'Updating connection...' },
            success: { title: mode === 'create' ? 'Connection created' : 'Connection updated' },
            error: { title: 'Failed to save connection' }
        });

        modalForm.close();
        onSuccess?.();
    };

    return (
        <Modal
            id={SSH_CONNECTION_MODAL_ID}
            title={mode === 'create' ? 'Add SSH Connection' : 'Edit SSH Connection'}
            width='460px'
            footer={
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        variant: 'outline',
                        command: 'close',
                        commandfor: SSH_CONNECTION_MODAL_ID
                    }}
                    primary={{
                        label: mode === 'create' ? 'Add Connection' : 'Save Changes',
                        type: 'submit',
                        form: SSH_CONNECTION_FORM_ID,
                        disabled: form.formState.isSubmitting,
                        isLoading: form.formState.isSubmitting
                    }}
                />
            }
        >
            <form id={SSH_CONNECTION_FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className='d-flex column gap-1 p-1-5'>
                <SSHConnectionForm control={form.control} mode={mode} />

                {mode === 'edit' && connection && (
                    <SSHConnectionTestButton connectionId={connection._id} />
                )}
            </form>
        </Modal>
    );
};

export default SSHConnectionModal;
