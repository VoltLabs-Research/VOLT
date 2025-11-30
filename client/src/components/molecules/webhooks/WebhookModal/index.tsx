import React, { useState, useEffect } from 'react';
import { TbX, TbWebhook } from 'react-icons/tb';
import type { Webhook, CreateWebhookData, UpdateWebhookData } from '@/types/models/webhook';
import { WEBHOOK_EVENTS } from '@/types/models/webhook';
import { useFormValidation } from '@/hooks/useFormValidation';
import './WebhookModal.css';

interface WebhookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CreateWebhookData | UpdateWebhookData) => Promise<void>;
    webhook?: Webhook | null;
    mode: 'create' | 'edit';
}

const WebhookModal: React.FC<WebhookModalProps> = ({
    isOpen,
    onClose,
    onSave,
    webhook,
    mode
}) => {
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        events: ['trajectory.created'] as string[]
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { errors, validate, checkField } = useFormValidation({
        name: { required: true, message: 'Webhook name is required' },
        url: {
            required: true,
            pattern: /^https?:\/\/.+/,
            message: 'Please enter a valid URL (http/https)'
        }
    });

    useEffect(() => {
        if (webhook) {
            setFormData({
                name: webhook.name,
                url: webhook.url,
                events: webhook.events
            });
        } else {
            setFormData({
                name: '',
                url: '',
                events: []
            });
        }
    }, [webhook]);

    const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
            await onSave(formData);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save webhook');
        } finally {
            setLoading(false);
        }
    };

    const handleEventChange = (event: string, checked: boolean) => {
        if (checked) {
            setFormData(prev => ({
                ...prev,
                events: [...prev.events, event]
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                events: prev.events.filter(e => e !== event)
            }));
        }
    };

    const handleSelectAll = () => {
        setFormData(prev => ({
            ...prev,
            events: [...WEBHOOK_EVENTS]
        }));
    };

    const handleSelectNone = () => {
        setFormData(prev => ({
            ...prev,
            events: []
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="webhook-modal-overlay">
            <div className="webhook-modal">
                <div className="webhook-modal-header">
                    <div className="webhook-modal-title">
                        <TbWebhook size={24} />
                        <h3>{mode === 'create' ? 'Create Webhook' : 'Edit Webhook'}</h3>
                    </div>
                    <button className="webhook-modal-close" onClick={onClose}>
                        <TbX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="webhook-modal-form">
                    <div className="webhook-modal-body">
                        {error && (
                            <div className="webhook-modal-error">
                                {error}
                            </div>
                        )}

                        <div className="webhook-form-group">
                            <label htmlFor="name">Webhook Name *</label>
                            <input
                                id="name"
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="e.g., Production Webhook, Development Webhook"
                                className={errors.name ? 'error' : ''}
                            />
                            {errors.name && <span className="text-xs text-red-500 mt-1">{errors.name}</span>}
                        </div>

                        <div className="webhook-form-group">
                            <label htmlFor="url">Webhook URL *</label>
                            <input
                                id="url"
                                type="url"
                                value={formData.url}
                                onChange={(e) => handleInputChange('url', e.target.value)}
                                placeholder="https://your-server.com/webhook"
                                className={errors.url ? 'error' : ''}
                            />
                            {errors.url && <span className="text-xs text-red-500 mt-1">{errors.url}</span>}
                        </div>

                        <div className="webhook-form-group">
                            <label>Events</label>
                            <div className="webhook-events">
                                <div className="webhook-event-actions">
                                    <button type="button" onClick={handleSelectAll} className="event-action-btn">
                                        Select All
                                    </button>
                                    <button type="button" onClick={handleSelectNone} className="event-action-btn">
                                        Select None
                                    </button>
                                </div>
                                <div className="webhook-event-list">
                                    {WEBHOOK_EVENTS.map(event => (
                                        <label key={event} className="webhook-event-item">
                                            <input
                                                type="checkbox"
                                                checked={formData.events.includes(event)}
                                                onChange={(e) => handleEventChange(event, e.target.checked)}
                                            />
                                            <span className="event-name">{event}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="webhook-modal-footer">
                        <button type="button" onClick={onClose} className="webhook-modal-cancel">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="webhook-modal-save"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : (mode === 'create' ? 'Create Webhook' : 'Update Webhook')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WebhookModal;
