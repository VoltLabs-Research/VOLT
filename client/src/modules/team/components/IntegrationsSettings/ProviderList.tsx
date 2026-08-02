import { Button, Row, Skeleton, Stack, Text } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { Settings2, Trash2 } from 'lucide-react';
import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { TeamAIIntegration } from '@volt/contracts/modules/team/domain';

interface ProviderListProps {
    integrations: TeamAIIntegration[];
    isLoading: boolean;
    hasError: boolean;
    busyProvider: AIProvider | null;
    onConfigure: (integration: TeamAIIntegration) => void;
    onRemove: (provider: AIProvider) => void;
    onRetry: () => void;
}

const ProviderList = ({
    integrations,
    isLoading,
    hasError,
    busyProvider,
    onConfigure,
    onRemove,
    onRetry
}: ProviderListProps) => {
    if (isLoading) {
        return (
            <div className='integrations-provider-list'>
                {Array.from({ length: 3 }).map((_, index) => (
                    <Row key={index} gap='1' justify='between' align='center' className='integrations-provider-row'>
                        <Skeleton variant='text' width={100} height={20} />
                        <Row gap='025'>
                            <Skeleton variant='circular' width={24} height={24} />
                            <Skeleton variant='circular' width={24} height={24} />
                        </Row>
                    </Row>
                ))}
            </div>
        );
    }

    if (hasError && integrations.length === 0) {
        return (
            <RecoveryState
                title='Unable to load integrations'
                description='Something went wrong while loading your AI provider integrations.'
                tone={RecoveryStateTone.Error}
                retryLabel='Try again'
                onRetry={onRetry}
            />
        );
    }

    if (integrations.length === 0) {
        return (
            <div className='integrations-empty-state'>
                <Text as='p' size='md' tone='muted'>
                    No providers configured yet.
                </Text>
            </div>
        );
    }

    return (
        <div className='integrations-provider-list'>
            {integrations.map((integration) => (
                <Row key={integration.provider} gap='1' justify='between' align='center' className='integrations-provider-row'>
                    <Stack gap='025' style={{ minWidth: 0 }}>
                        <Text as='p' size='md' weight='medium' tone='primary'>
                            {integration.providerName}
                        </Text>
                        <Text as='p' size='sm' tone='muted' truncate title={integration.defaultModel ?? 'No default model selected'}>
                            {integration.defaultModel
                                ? `Default model: ${integration.defaultModel}`
                                : 'No default model selected'}
                        </Text>
                    </Stack>

                    <Row gap='025' className='integrations-provider-row-actions'>
                        <Button
                            size='sm'
                            variant='ghost'
                            intent='neutral'
                            leftIcon={<Settings2 size={14} />}
                            onClick={() => onConfigure(integration)}
                            title={`Configure ${integration.providerName}`}
                            aria-label={`Configure ${integration.providerName}`}
                        />
                        <Button
                            size='sm'
                            variant='ghost'
                            intent='danger'
                            leftIcon={<Trash2 size={14} />}
                            onClick={() => onRemove(integration.provider)}
                            isLoading={busyProvider === integration.provider}
                            title={`Remove ${integration.providerName}`}
                            aria-label={`Remove ${integration.providerName}`}
                        />
                    </Row>
                </Row>
            ))}
        </div>
    );
};

export default ProviderList;
