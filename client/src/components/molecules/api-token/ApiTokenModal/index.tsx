import React, { useState, useEffect } from 'react';
import { TbX, TbKey } from 'react-icons/tb';
import type { ApiToken, CreateTokenData, UpdateTokenData } from '@/types/models/api-token';
import { API_TOKEN_PERMISSIONS } from '@/types/models/api-token';
import { useFormValidation } from '@/hooks/useFormValidation';
import './ApiTokenModal.css';

interface ApiTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CreateTokenData | UpdateTokenData) => Promise<void>;
    token?: ApiToken | null;
    mode: 'create' | 'edit';
}

const ApiTokenModal: React.FC<ApiTokenModalProps> = ({
    isOpen,
    onClose,
    onSave,
    token,
    mode
}) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        permissions: ['read:trajectories'] as string[],
        expiresAt: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { errors, validate, checkField } = useFormValidation({
        name: { required: true, message: 'Token name is required' }
    });

    useEffect(() => {
        if (mode === 'edit' && token) {
            setFormData({
                name: token.name,
                description: token.description || '',
                permissions: token.permissions,
                expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString().split('T')[0] : ''
            });
        } else {
            setFormData({
                name: '',
                description: '',
                permissions: [],
                expiresAt: ''
            });
        }
        setError(null);
    }, [token, isOpen, mode]); // Re-added mode and isOpen as they were in the original and the instruction didn't explicitly remove them from dependencies, only the body logic.

    const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFormData(prev => ({ ...prev, [field]: value }));
        checkField(field, value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate(formData)) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const submitData = {
                ...formData,
                expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined
            };

            await onSave(submitData);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save token');
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionChange = (permission: string, checked: boolean) => {
        if (checked) {
            setFormData(prev => ({
                ...prev,
                permissions: [...prev.permissions, permission]
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                permissions: prev.permissions.filter(p => p !== permission)
            }));
        }
    };

    const handleSelectAll = () => {
        setFormData(prev => ({
            ...prev,
            permissions: [...API_TOKEN_PERMISSIONS]
        }));
    };

    const handleSelectNone = () => {
        setFormData(prev => ({
            ...prev,
            permissions: []
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="api-token-modal-overlay">
            <div className="api-token-modal">
                <div className="api-token-modal-header">
                    <div className="api-token-modal-title">
                        <TbKey size={24} />
                        <h3>{mode === 'create' ? 'Create API Token' : 'Edit API Token'}</h3>
                    </div>
                    <button className="api-token-modal-close" onClick={onClose}>
                        <TbX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="api-token-modal-form">
                    <div className="api-token-modal-body">
                        {error && (
                            <div className="api-token-modal-error">
                                {error}
                            </div>
                        )}

                        <div className="api-token-form-group">
                            <label htmlFor="name">Token Name *</label>
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="e.g., Production API, Development API"
                                className={errors.name ? 'error' : ''}
                            />
                            {errors.name && <span className="text-xs text-red-500 mt-1">{errors.name}</span>}
                        </div>

                        <div className="api-token-form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Optional description for this token"
                                rows={3}
                            />
                        </div>

                        <div className="api-token-form-group">
                            <label>Permissions</label>
                            <div className="api-token-permissions">
                                <div className="api-token-permission-actions">
                                    <button type="button" onClick={handleSelectAll} className="permission-action-btn">
                                        Select All
                                    </button>
                                    <button type="button" onClick={handleSelectNone} className="permission-action-btn">
                                        Select None
                                    </button>
                                </div>
                                <div className="api-token-permission-list">
                                    {API_TOKEN_PERMISSIONS.map(permission => (
                                        <label key={permission} className="api-token-permission-item">
                                            <input
                                                type="checkbox"
                                                checked={formData.permissions.includes(permission)}
                                                onChange={(e) => handlePermissionChange(permission, e.target.checked)}
                                            />
                                            <span className="permission-name">{permission}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="api-token-form-group">
                            <label htmlFor="expiresAt">Expiration Date</label>
                            <input
                                id="expiresAt"
                                type="datetime-local"
                                value={formData.expiresAt}
                                onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                            />
                            <small>Leave empty for no expiration</small>
                        </div>
                    </div>

                    <div className="api-token-modal-footer">
                        <button type="button" onClick={onClose} className="api-token-modal-cancel">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="api-token-modal-save"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : (mode === 'create' ? 'Create Token' : 'Update Token')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ApiTokenModal;
