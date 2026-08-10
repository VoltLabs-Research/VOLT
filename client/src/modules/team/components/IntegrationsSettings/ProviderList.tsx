import { Button, Skeleton } from '@voltstack/bravais';
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
                    <div className='flex flex-row items-center justify-between gap-4 integrations-provider-row' key={index}>
                        <Skeleton variant='text' width={100} height={20} />
                        <div className='flex flex-row items-center gap-1'>
                            <Skeleton variant='circular' width={24} height={24} />
                            <Skeleton variant='circular' width={24} height={24} />
                        </div>
                    </div>
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
                <p className='text-sm text-muted'>
                    No providers configured yet.
                </p>
            </div>
        );
    }

    return (
        <div className='integrations-provider-list'>
            {integrations.map((integration) => (
                <div className='flex flex-row items-center justify-between gap-4 integrations-provider-row' key={integration.provider}>
                    <div className='flex flex-col gap-1' style={{ minWidth: 0 }}>
                        <p className='text-sm font-medium text-foreground'>
                            {integration.providerName}
                        </p>
                        <p className='text-xs text-muted truncate' title={integration.defaultModel ?? 'No default model selected'}>
                            {integration.defaultModel
                                ? `Default model: ${integration.defaultModel}`
                                : 'No default model selected'}
                        </p>
                    </div>

                    <div className='flex flex-row items-center gap-1 integrations-provider-row-actions'>
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
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProviderList;
