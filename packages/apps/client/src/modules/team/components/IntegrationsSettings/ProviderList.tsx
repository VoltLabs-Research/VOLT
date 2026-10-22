import Loader from '@/shared/ui/components/Loader';
import { Button, Skeleton } from '@heroui/react';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { Settings2, Trash2 } from 'lucide-react';
import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { TeamAIIntegration } from '@volt/contracts/modules/team/domain';

// 36px icon buttons, muted until hovered, like the rest of the chrome.
const ROW_ICON_BUTTON_CLASS = 'rounded-lg text-muted hover:bg-foreground/6 hover:text-foreground';

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
            <div className='flex flex-col gap-2'>
                {Array.from({ length: 3 }).map((_, index) => (
                    <div className='flex flex-col gap-2 rounded-2xl bg-foreground/4 p-5' key={index}>
                        <Skeleton className='h-4 w-24 rounded-full' />
                        <Skeleton className='h-3.5 w-48 rounded-full' />
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
        <div className='flex flex-col gap-2'>
            {integrations.map((integration) => (
                <div className='flex flex-row items-center justify-between gap-4 rounded-2xl bg-foreground/4 p-5' key={integration.provider}>
                    <div className='flex flex-col gap-0.5 min-w-0'>
                        <p className='text-base font-medium text-foreground'>
                            {integration.providerName}
                        </p>
                        <p className='text-sm text-muted truncate' title={integration.defaultModel ?? 'No default model selected'}>
                            {integration.defaultModel
                                ? `Default model: ${integration.defaultModel}`
                                : 'No default model selected'}
                        </p>
                    </div>
                    <div className='flex flex-row items-center gap-1'>
                        <Button
                            isIconOnly
                            variant='ghost'
                            className={ROW_ICON_BUTTON_CLASS}
                            onPress={() => onConfigure(integration)}
                            aria-label={`Configure ${integration.providerName}`}
                        >
                            <span className='flex items-center justify-center' title={`Configure ${integration.providerName}`}>
                                <Settings2 size={16} aria-hidden='true' />
                            </span>
                        </Button>
                        <Button
                            isIconOnly
                            variant='ghost'
                            className={ROW_ICON_BUTTON_CLASS}
                            onPress={() => onRemove(integration.provider)}
                            isPending={busyProvider === integration.provider}
                            aria-label={`Remove ${integration.providerName}`}
                        >
                            <span className='flex items-center justify-center' title={`Remove ${integration.providerName}`}>
                                {busyProvider === integration.provider
                                    ? <Loader size='sm' color='current' />
                                    : <Trash2 size={16} aria-hidden='true' />}
                            </span>
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProviderList;
