import React, { useState } from 'react';
import { TbKey, TbEdit, TbTrash, TbCopy, TbEye, TbEyeOff, TbCalendar, TbActivity } from 'react-icons/tb';
import { formatDistanceToNow, isValid } from 'date-fns';
import type { ApiToken } from '@/types/models/api-token';
import './ApiTokenList.css';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

interface ApiTokenListProps {
    tokens: ApiToken[];
    loading: boolean;
    onEdit: (token: ApiToken) => void;
    onDelete: (token: ApiToken) => void;
    onRegenerate: (token: ApiToken) => void;
}

const ApiTokenList: React.FC<ApiTokenListProps> = ({
    tokens,
    loading,
    onEdit,
    onDelete,
    onRegenerate
}) => {
    const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const toggleTokenVisibility = (tokenId: string) => {
        setVisibleTokens(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tokenId)) {
                newSet.delete(tokenId);
            } else {
                newSet.add(tokenId);
            }
            return newSet;
        });
    };

    const copyToClipboard = async (text: string, tokenId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedToken(tokenId);
            setTimeout(() => setCopiedToken(null), 2000);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'var(--color-success)';
            case 'inactive': return 'var(--color-warning)';
            case 'expired': return 'var(--color-error)';
            default: return 'var(--color-text-secondary)';
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
            <div className="d-flex column gap-1 api-token-list-loading">
                <div className="d-flex items-center gap-1 api-token-skeleton">
                    <div className="skeleton-icon"></div>
                    <div className="d-flex column gap-05 flex-1 skeleton-content">
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line short"></div>
                    </div>
                    <div className="d-flex gap-05 skeleton-actions">
                        <div className="skeleton-button"></div>
                        <div className="skeleton-button"></div>
                    </div>
                </div>
                <div className="d-flex items-center gap-1 api-token-skeleton">
                    <div className="skeleton-icon"></div>
                    <div className="d-flex column gap-05 flex-1 skeleton-content">
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

    if (tokens.length === 0) {
        return (
            <div className="api-token-list-empty">
                <div className="empty-icon">
                    <TbKey size={48} />
                </div>
                <Title className='font-size-3'>No API Tokens</Title>
                <Paragraph>Create your first API token to start using the API programmatically.</Paragraph>
            </div>
        );
    }

    return (
        <div className="d-flex column gap-1 api-token-list">
            {tokens.map((token) => (
                <div key={token._id} className="d-flex items-center content-between api-token-item">
                    <div className="d-flex items-center gap-1 flex-1 api-token-info">
                        <div className="d-flex flex-center api-token-icon">
                            <TbKey size={20} />
                        </div>
                        <div className="flex-1 api-token-details">
                            <div className="d-flex items-center gap-075 api-token-header">
                                <span className="api-token-name">{token.name}</span>
                                <span
                                    className="api-token-status"
                                    style={{ color: getStatusColor(token.status) }}
                                >
                                    {token.status}
                                </span>
                            </div>
                            <div className="api-token-meta">
                                <span className="api-token-key">
                                    {visibleTokens.has(token._id) && token.token
                                        ? token.token
                                        : token.maskedToken
                                    }
                                </span>
                                {token.description && (
                                    <span className="api-token-description">{token.description}</span>
                                )}
                            </div>
                            <div className="d-flex flex-wrap gap-1 api-token-stats">
                                {token.lastUsedAt && (
                                    <span className="d-flex items-center gap-025 api-token-stat">
                                        <TbActivity size={14} />
                                        Last used {formatDate(token.lastUsedAt)}
                                    </span>
                                )}
                                {token.expiresAt && (
                                    <span className="d-flex items-center gap-025 api-token-stat">
                                        <TbCalendar size={14} />
                                        Expires {formatDate(token.expiresAt)}
                                    </span>
                                )}
                                <span className="api-token-stat">
                                    Created {formatDate(token.createdAt)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex items-center gap-05 api-token-actions">
                        {token.token && visibleTokens.has(token._id) && (
                            <button
                                className="d-flex items-center gap-05 api-token-action-btn copy"
                                onClick={() => copyToClipboard(token.token!, token._id)}
                                title="Copy token"
                            >
                                <TbCopy size={16} />
                                {copiedToken === token._id ? 'Copied!' : 'Copy'}
                            </button>
                        )}
                        <button
                            className="api-token-action-btn"
                            onClick={() => toggleTokenVisibility(token._id)}
                            title={visibleTokens.has(token._id) ? 'Hide token' : 'Show token'}
                        >
                            {visibleTokens.has(token._id) ? <TbEyeOff size={16} /> : <TbEye size={16} />}
                        </button>
                        <button
                            className="api-token-action-btn"
                            onClick={() => onEdit(token)}
                            title="Edit token"
                        >
                            <TbEdit size={16} />
                        </button>
                        <button
                            className="api-token-action-btn"
                            onClick={() => onRegenerate(token)}
                            title="Regenerate token"
                        >
                            <TbKey size={16} />
                        </button>
                        <button
                            className="api-token-action-btn danger"
                            onClick={() => onDelete(token)}
                            title="Delete token"
                        >
                            <TbTrash size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ApiTokenList;
