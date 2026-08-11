import { Button, Skeleton, Spinner } from '@heroui/react';
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
            <div className='border-t border-border'>
                {Array.from({ length: 3 }).map((_, index) => (
                    <div className='group flex flex-row items-center justify-between gap-4 border-b border-border py-3 min-h-14 transition-colors duration-[120ms] ease-out' key={index}>
                        <Skeleton className='h-5 w-[100px] rounded-md' />
                        <div className='flex flex-row items-center gap-1'>
                            <Skeleton className='size-6 rounded-full' />
                            <Skeleton className='size-6 rounded-full' />
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
            <div className='py-10 text-center'>
                <p className='text-sm text-muted'>
                    No providers configured yet.
                </p>
            </div>
        );
    }

    return (
        <div className='border-t border-border'>
            {integrations.map((integration) => (
                <div className='group flex flex-row items-center justify-between gap-4 border-b border-border py-3 min-h-14 transition-colors duration-[120ms] ease-out' key={integration.provider}>
                    <div className='flex flex-col gap-1 min-w-0'>
                        <p className='text-sm font-medium text-foreground'>
                            {integration.providerName}
                        </p>
                        <p className='text-xs text-muted truncate' title={integration.defaultModel ?? 'No default model selected'}>
                            {integration.defaultModel
                                ? `Default model: ${integration.defaultModel}`
                                : 'No default model selected'}
                        </p>
                    </div>
                    <div className='flex flex-row items-center gap-1 opacity-75 transition-opacity duration-[120ms] group-hover:opacity-100 max-[640px]:opacity-100'>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='ghost'
                            onPress={() => onConfigure(integration)}
                            aria-label={`Configure ${integration.providerName}`}
                        >
                            <span className='flex items-center justify-center' title={`Configure ${integration.providerName}`}>
                                <Settings2 size={14} aria-hidden='true' />
                            </span>
                        </Button>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='ghost'
                            className='text-danger'
                            onPress={() => onRemove(integration.provider)}
                            isPending={busyProvider === integration.provider}
                            aria-label={`Remove ${integration.providerName}`}
                        >
                            <span className='flex items-center justify-center' title={`Remove ${integration.providerName}`}>
                                {busyProvider === integration.provider
                                    ? <Spinner size='sm' color='current' />
                                    : <Trash2 size={14} aria-hidden='true' />}
                            </span>
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProviderList;
