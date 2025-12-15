import React, { useState } from 'react';
import { TbWebhook, TbEdit, TbTrash, TbTestPipe, TbActivity, TbGlobe, TbCheck, TbX } from 'react-icons/tb';
import { formatDistanceToNow, isValid } from 'date-fns';
import type { Webhook } from '@/types/models/webhook';
import './WebhookList.css';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

interface WebhookListProps {
    webhooks: Webhook[];
    loading: boolean;
    onEdit: (webhook: Webhook) => void;
    onDelete: (webhook: Webhook) => void;
    onTest: (webhook: Webhook) => void;
}

const WebhookList: React.FC<WebhookListProps> = ({
    webhooks,
    loading,
    onEdit,
    onDelete,
    onTest
}) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'var(--color-success)';
            case 'inactive': return 'var(--color-warning)';
            case 'failed': return 'var(--color-error)';
            default: return 'var(--color-text-secondary)';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <TbCheck size={16} />;
            case 'inactive': return <TbX size={16} />;
            case 'failed': return <TbX size={16} />;
            default: return <TbActivity size={16} />;
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : 'Unknown';
        } catch {
            return 'Unknown';
        }
    };

    if (loading) {
        return (
            <div className="d-flex column gap-1 webhook-list-loading">
                <div className="d-flex items-center gap-1 webhook-skeleton">
                    <div className="skeleton-icon"></div>
                    <div className="d-flex column gap-05 skeleton-content">
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line short"></div>
                    </div>
                    <div className="d-flex gap-05 skeleton-actions">
                        <div className="skeleton-button"></div>
                        <div className="skeleton-button"></div>
                    </div>
                </div>
                <div className="d-flex items-center gap-1 webhook-skeleton">
                    <div className="skeleton-icon"></div>
                    <div className="d-flex column gap-05 skeleton-content">
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line short"></div>
                    </div>
                    <div className="d-flex gap-05 skeleton-actions">
                        <div className="skeleton-button"></div>
                        <div className="skeleton-button"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (webhooks.length === 0) {
        return (
            <div className="webhook-list-empty">
                <div className="empty-icon">
                    <TbWebhook size={48} />
                </div>
                <Title className='font-size-3'>No Webhooks</Title>
                <Paragraph>Create your first webhook to receive real-time notifications from the app.</Paragraph>
            </div>
        );
    }

    return (
        <div className="d-flex column gap-1 webhook-list">
            {webhooks.map((webhook) => (
                <div key={webhook._id} className="d-flex items-center content-between webhook-item">
                    <div className="d-flex items-center gap-1 webhook-info">
                        <div className="d-flex flex-center webhook-icon">
                            <TbWebhook size={20} />
                        </div>
                        <div className="webhook-details">
                            <div className="d-flex items-center gap-075 webhook-header">
                                <span className="webhook-name">{webhook.name}</span>
                                <span
                                    className="d-flex items-center gap-025 webhook-status"
                                    style={{ color: getStatusColor(webhook.status) }}
                                >
                                    {getStatusIcon(webhook.status)}
                                    {webhook.status}
                                </span>
                            </div>
                            <div className="webhook-meta">
                                <span className="d-flex items-center gap-025 webhook-url">
                                    <TbGlobe size={14} />
                                    {webhook.url}
                                </span>
                                <span className="webhook-events">
                                    {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="d-flex flex-wrap gap-1 webhook-stats">
                                {webhook.lastTriggered && (
                                    <span className="d-flex items-center gap-025 webhook-stat">
                                        <TbActivity size={14} />
                                        Last triggered {formatDate(webhook.lastTriggered)}
                                    </span>
                                )}
                                {webhook.failureCount > 0 && (
                                    <span className="d-flex items-center gap-025 webhook-stat error">
                                        {webhook.failureCount} failure{webhook.failureCount !== 1 ? 's' : ''}
                                    </span>
                                )}
                                <span className="d-flex items-center gap-025 webhook-stat">
                                    Created {formatDate(webhook.createdAt)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex items-center gap-05 webhook-actions">
                        <button
                            className="d-flex items-center gap-025 webhook-action-btn test"
                            onClick={() => onTest(webhook)}
                            title="Test webhook"
                        >
                            <TbTestPipe size={16} />
                            Test
                        </button>
                        <button
                            className="d-flex items-center gap-025 webhook-action-btn"
                            onClick={() => onEdit(webhook)}
                            title="Edit webhook"
                        >
                            <TbEdit size={16} />
                        </button>
                        <button
                            className="d-flex items-center gap-025 webhook-action-btn danger"
                            onClick={() => onDelete(webhook)}
                            title="Delete webhook"
                        >
                            <TbTrash size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default WebhookList;
