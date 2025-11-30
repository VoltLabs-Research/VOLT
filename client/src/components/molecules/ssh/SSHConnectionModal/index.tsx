import React, { useState, useEffect } from 'react';
import { TbX, TbServer, TbCheck, TbX as TbXIcon } from 'react-icons/tb';
import useSSHConnections, { type CreateSSHConnectionData, type UpdateSSHConnectionData, type SSHConnection } from '@/stores/ssh-connections';
import './SSHConnectionModal.css';

interface SSHConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    connection?: SSHConnection | null;
    mode: 'create' | 'edit';
}

const SSHConnectionModal: React.FC<SSHConnectionModalProps> = ({
    isOpen,
    onClose,
    connection,
    mode
}) => {
    const [formData, setFormData] = useState({
        name: '',
        host: '',
        port: 22,
        username: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
    const [testing, setTesting] = useState(false);

    const { createConnection, updateConnection, testConnection } = useSSHConnections();

    useEffect(() => {
        if (mode === 'edit' && connection) {
            setFormData({
                name: connection.name,
                host: connection.host,
                port: connection.port,
                username: connection.username,
                password: '' // Don't populate password for security
            });
        } else {
            setFormData({
                name: '',
                host: '',
                port: 22,
                username: '',
                password: ''
            });
        }
        setError(null);
        setTestResult(null);
    }, [mode, connection, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.host.trim() || !formData.username.trim()) {
            setError('Name, host, and username are required');
            return;
        }

        if (mode === 'create' && !formData.password.trim()) {
            setError('Password is required');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            if (mode === 'create') {
                await createConnection(formData as CreateSSHConnectionData);
            } else if (connection) {
                const updateData: UpdateSSHConnectionData = {
                    name: formData.name,
                    host: formData.host,
                    port: formData.port,
                    username: formData.username
                };
                // Only include password if it was changed
                if (formData.password.trim()) {
                    updateData.password = formData.password;
                }
                await updateConnection(connection._id, updateData);
            }

            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save SSH connection');
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        if (!connection && mode === 'edit') return;

        // If creating, we need to save first
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

    if (!isOpen) return null;

    return (
        <div className="ssh-connection-modal-overlay" onClick={onClose}>
            <div className="ssh-connection-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ssh-connection-modal-header">
                    <div className="ssh-connection-modal-title">
                        <TbServer size={24} />
                        <h3>{mode === 'create' ? 'Add SSH Connection' : 'Edit SSH Connection'}</h3>
                    </div>
                    <button className="ssh-connection-modal-close" onClick={onClose}>
                        <TbX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="ssh-connection-modal-form">
                    <div className="ssh-connection-modal-body">
                        {error && (
                            <div className="ssh-connection-modal-error">
                                {error}
                            </div>
                        )}

                        <div className="ssh-connection-form-group">
                            <label htmlFor="name">Connection Name *</label>
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Production Server, Lab Computer"
                                required
                            />
                        </div>

                        <div className="ssh-connection-form-group">
                            <label htmlFor="host">Host *</label>
                            <input
                                id="host"
                                type="text"
                                value={formData.host}
                                onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                                placeholder="hostname or IP address"
                                required
                            />
                        </div>

                        <div className="ssh-connection-form-group">
                            <label htmlFor="port">Port</label>
                            <input
                                id="port"
                                type="number"
                                value={formData.port}
                                onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                                min="1"
                                max="65535"
                            />
                            <small>Default: 22</small>
                        </div>

                        <div className="ssh-connection-form-group">
                            <label htmlFor="username">Username *</label>
                            <input
                                id="username"
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                placeholder="SSH username"
                                required
                            />
                        </div>

                        <div className="ssh-connection-form-group">
                            <label htmlFor="password">Password {mode === 'create' ? '*' : ''}</label>
                            <input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                placeholder={mode === 'edit' ? 'Leave empty to keep current' : 'SSH password'}
                                required={mode === 'create'}
                            />
                        </div>

                        {mode === 'edit' && connection && (
                            <div className="ssh-connection-form-group">
                                <div className="ssh-connection-test-container">
                                    <button
                                        type="button"
                                        className="ssh-connection-test-btn"
                                        onClick={handleTest}
                                        disabled={testing}
                                    >
                                        {testing ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    {testResult && (
                                        <div className={`ssh-connection-test-result ${testResult.valid ? 'success' : 'error'}`}>
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

                    <div className="ssh-connection-modal-footer">
                        <button type="button" onClick={onClose} className="ssh-connection-modal-cancel">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="ssh-connection-modal-save"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : (mode === 'create' ? 'Add Connection' : 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SSHConnectionModal;
