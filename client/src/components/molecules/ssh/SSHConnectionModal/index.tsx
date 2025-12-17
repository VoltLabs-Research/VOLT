import React, { useState, useEffect } from 'react';
import { TbX, TbServer, TbCheck, TbX as TbXIcon } from 'react-icons/tb';
import useSSHConnections, { type CreateSSHConnectionData, type UpdateSSHConnectionData, type SSHConnection } from '@/stores/ssh-connections';
import { useFormValidation } from '@/hooks/useFormValidation';
import './SSHConnectionModal.css';
import Title from '@/components/primitives/Title';
import Button from '@/components/primitives/Button';
import Modal from '@/components/molecules/common/Modal';

interface SSHConnectionModalProps {
    connection?: SSHConnection | null;
    mode: 'create' | 'edit';
}

const SSHConnectionModal: React.FC<SSHConnectionModalProps> = ({
    connection,
    mode
}) => {
    const [formData, setFormData] = useState<{
        name: string;
        host: string;
        port: string | number;
        username: string;
        password: string;
    }>({
        name: '',
        host: '',
        port: '22',
        username: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
    const [testing, setTesting] = useState(false);

    const { createConnection, updateConnection, testConnection } = useSSHConnections();

    const { errors, validate, checkField } = useFormValidation({
        name: { required: true, message: 'Connection name is required' },
        host: { required: true, message: 'Host is required' },
        port: {
            required: true,
            validate: (value) => {
                const port = parseInt(value);
                return !isNaN(port) && port > 0 && port <= 65535 || 'Port must be between 1 and 65535';
            }
        },
        username: { required: true, message: 'Username is required' },
        password: {
            required: mode === 'create',
            message: 'Password is required'
        }
    });

    useEffect(() => {
        if (mode === 'edit' && connection) {
            setFormData({
                name: connection.name,
                host: connection.host,
                port: connection.port.toString(),
                username: connection.username,
                password: ''
            });
        } else {
            setFormData({
                name: '',
                host: '',
                port: '22',
                username: '',
                password: ''
            });
        }
        setError(null);
        setTestResult(null);
    }, [mode, connection]);

    const handleInputChange = (field: keyof typeof formData, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        checkField(field, value);
    };

    const closeModal = () => {
        (document.getElementById('ssh-connection-modal') as HTMLDialogElement)?.close();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate(formData)) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            if (mode === 'create') {
                const createData: CreateSSHConnectionData = {
                    ...formData,
                    port: typeof formData.port === 'string' ? parseInt(formData.port) : formData.port
                };
                await createConnection(createData);
            } else if (connection) {
                const updateData: UpdateSSHConnectionData = {
                    name: formData.name,
                    host: formData.host,
                    port: typeof formData.port === 'string' ? parseInt(formData.port) : formData.port,
                    username: formData.username
                };
                if (formData.password.trim()) {
                    updateData.password = formData.password;
                }
                await updateConnection(connection._id, updateData);
            }

            closeModal();
        } catch (err: any) {
            setError(err.message || 'Failed to save SSH connection');
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        if (!connection && mode === 'edit') return;

        if (mode === 'create') {
            setError('Please save the connection first before testing');
            return;
        }

        try {
            setTesting(true);
            setTestResult(null);
            const result = await testConnection(connection!._id);
            setTestResult(result);
        } catch (err: any) {
            setTestResult({ valid: false, error: err.message });
        } finally {
            setTesting(false);
        }
    };

    return (
        <Modal
            id='ssh-connection-modal'
            title={mode === 'create' ? 'Add SSH Connection' : 'Edit SSH Connection'}
            width='500px'
            className='ssh-connection-modal overflow-hidden'
        >
            <form onSubmit={handleSubmit} className="d-flex column gap-1 ssh-connection-modal-form overflow-hidden">
                <div className="flex-1 ssh-connection-modal-body y-auto">
                    {error && (
                        <div className="ssh-connection-modal-error font-size-2">
                            {error}
                        </div>
                    )}

                    <div className="ssh-connection-form-group">
                        <label htmlFor="name">Connection Name *</label>
                        <input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            placeholder="e.g., Production Server, Lab Computer"
                            className={errors.name ? 'error' : ''}
                        />
                        {errors.name && <span className="ssh-connection-field-error">{errors.name}</span>}
                    </div>

                    <div className="ssh-connection-form-group">
                        <label htmlFor="host">Host *</label>
                        <input
                            id="host"
                            type="text"
                            value={formData.host}
                            onChange={(e) => handleInputChange('host', e.target.value)}
                            placeholder="hostname or IP address"
                            className={errors.host ? 'error' : ''}
                        />
                        {errors.host && <span className="ssh-connection-field-error">{errors.host}</span>}
                    </div>

                    <div className="ssh-connection-form-group">
                        <label htmlFor="port">Port</label>
                        <input
                            id="port"
                            type="number"
                            value={formData.port}
                            onChange={(e) => handleInputChange('port', e.target.value)}
                            min="1"
                            max="65535"
                            className={errors.port ? 'error' : ''}
                        />
                        <small>Default: 22</small>
                        {errors.port && <span className="ssh-connection-field-error">{errors.port}</span>}
                    </div>

                    <div className="ssh-connection-form-group">
                        <label htmlFor="username">Username *</label>
                        <input
                            id="username"
                            type="text"
                            value={formData.username}
                            onChange={(e) => handleInputChange('username', e.target.value)}
                            placeholder="SSH username"
                            className={errors.username ? 'error' : ''}
                        />
                        {errors.username && <span className="ssh-connection-field-error">{errors.username}</span>}
                    </div>

                    <div className="ssh-connection-form-group">
                        <label htmlFor="password">Password {mode === 'create' ? '*' : ''}</label>
                        <input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            placeholder={mode === 'edit' ? 'Leave empty to keep current' : 'SSH password'}
                            className={errors.password ? 'error' : ''}
                        />
                        {errors.password && <span className="ssh-connection-field-error">{errors.password}</span>}
                    </div>

                    {mode === 'edit' && connection && (
                        <div className="ssh-connection-form-group">
                            <div className="d-flex items-center gap-075 ssh-connection-test-container">
                                <Button
                                    variant="outline"
                                    intent="neutral"
                                    size="sm"
                                    onClick={handleTest}
                                    disabled={testing}
                                >
                                    {testing ? 'Testing...' : 'Test Connection'}
                                </Button>
                                {testResult && (
                                    <div className={`d-flex items-center gap-05 ssh-connection-test-result ${testResult.valid ? 'success' : 'error'} font-size-2`}>
                                        {testResult.valid ? (
                                            <>
                                                <TbCheck size={16} />
                                                <span>Connection successful</span>
                                            </>
                                        ) : (
                                            <>
                                                <TbXIcon size={16} />
                                                <span>{testResult.error || 'Connection failed'}</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="d-flex content-end gap-075 ssh-connection-modal-footer">
                    <Button
                        variant="outline"
                        intent="neutral"
                        commandfor="ssh-connection-modal"
                        command="close"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="solid"
                        intent="brand"
                        disabled={loading}
                        isLoading={loading}
                    >
                        {mode === 'create' ? 'Add Connection' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default SSHConnectionModal;
