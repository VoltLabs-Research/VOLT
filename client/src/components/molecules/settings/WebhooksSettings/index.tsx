import React from 'react';
import { TbPlus } from 'react-icons/tb';
import Section from '@/components/atoms/settings/Section';
import SectionHeader from '@/components/atoms/settings/SectionHeader';
import WebhookList from '@/components/molecules/webhooks/WebhookList';
import type { Webhook } from '@/types/models/webhook';

interface WebhooksSettingsProps {
    webhooks: Webhook[];
    loading: boolean;
    error: string | null;
    onCreateWebhook: () => void;
    onEditWebhook: (webhook: Webhook) => void;
    onDeleteWebhook: (webhook: Webhook) => void;
    onTestWebhook: (webhook: Webhook) => void;
}

const WebhooksSettings: React.FC<WebhooksSettingsProps> = ({
    webhooks,
    loading,
    error,
    onCreateWebhook,
    onEditWebhook,
    onDeleteWebhook,
    onTestWebhook
}) => {
    return (
        <Section>
            <SectionHeader 
                title='Webhooks' 
                description='Configure webhooks to receive real-time notifications'
            >
                <button
                    className='action-button primary'
                    onClick={onCreateWebhook}
                >
                    <TbPlus size={16} />
                    Create Webhook
                </button>
            </SectionHeader>

            {error && (
                <div className='error-message'>
                    {error}
                </div>
            )}

            <WebhookList
                webhooks={webhooks}
                loading={loading}
                onEdit={onEditWebhook}
                onDelete={onDeleteWebhook}
                onTest={onTestWebhook}
            />
        </Section>
    );
};

export default WebhooksSettings;
