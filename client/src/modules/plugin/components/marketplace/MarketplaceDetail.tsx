import { Button } from '@heroui/react';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { resolveInstallState } from '@/modules/plugin/components/marketplace/registry-version';
import { ArrowLeft } from 'lucide-react';

import type { RegistryPackageSummary } from '@volt/contracts/modules/plugin/registry';

const compactCount = (value: number): string => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
    return String(value);
};

interface DetailFact {
    label: string;
    value: string;
}

interface MarketplaceDetailProps {
    item: RegistryPackageSummary;
    installedVersion?: string;
    isInstalling: boolean;
    isAnyInstalling: boolean;
    canInstall: boolean;
    onInstall: (item: RegistryPackageSummary) => void;
    onBack: () => void;
}

const MarketplaceDetail = ({
    item,
    installedVersion,
    isInstalling,
    isAnyInstalling,
    canInstall,
    onInstall,
    onBack
}: MarketplaceDetailProps) => {
    const state = resolveInstallState(item.latest, installedVersion);
    const updated = item.updatedAt ? formatCompactRelativeTime(item.updatedAt) : undefined;

    const facts: DetailFact[] = [
        item.latest ? { label: 'Latest version', value: item.latest } : undefined,
        installedVersion
            ? { label: 'Installed version', value: installedVersion || 'unknown' }
            : undefined,
        { label: 'Author', value: `@${item.username}` },
        { label: 'Package', value: item.fullName },
        item.kind ? { label: 'Kind', value: item.kind } : undefined,
        item.downloads?.total === undefined
            ? undefined
            : { label: 'Downloads', value: `${compactCount(item.downloads.total)} total` },
        item.downloads?.last30d === undefined
            ? undefined
            : { label: 'Last 30 days', value: `${compactCount(item.downloads.last30d)} downloads` },
        updated ? { label: 'Updated', value: updated } : undefined
    ].filter((fact): fact is DetailFact => fact !== undefined);

    const installDisabledReason = canInstall
        ? (isAnyInstalling && !isInstalling ? 'Another install is running' : undefined)
        : 'You do not have permission to install plugins.';

    return (
        <div className='flex flex-col gap-8 p-8 max-md:gap-6 max-md:p-5'>
            <Button
                variant='ghost'
                size='sm'
                onPress={onBack}
                className='w-fit md:hidden'
            >
                <ArrowLeft size={14} />
                Back to list
            </Button>

            <div className='flex flex-col gap-4'>
                <div className='flex flex-row flex-wrap items-start justify-between gap-4'>
                    <div className='flex min-w-0 flex-col gap-1'>
                        <h3 className='text-xl font-medium text-foreground'>{item.name}</h3>
                        <span className='text-xs text-muted'>{`@${item.username}`}</span>
                    </div>

                    {state === 'installed' ? (
                        <span className='shrink-0 text-xs text-muted'>Installed</span>
                    ) : (
                        <span className='inline-flex shrink-0' title={installDisabledReason}>
                            <Button
                                variant='primary'
                                onPress={() => onInstall(item)}
                                isPending={isInstalling}
                                isDisabled={!canInstall || isAnyInstalling}
                            >
                                {state === 'update' ? 'Update' : 'Install'}
                            </Button>
                        </span>
                    )}
                </div>

                {item.description && (
                    <p className='max-w-prose text-sm leading-normal text-foreground'>{item.description}</p>
                )}
            </div>

            {item.keywords && item.keywords.length > 0 && (
                <div className='flex flex-row flex-wrap gap-1.5'>
                    {item.keywords.map((keyword) => (
                        <span
                            className='rounded-md bg-surface-secondary px-2 py-1 text-2xs text-muted'
                            key={keyword}
                        >
                            {keyword}
                        </span>
                    ))}
                </div>
            )}

            <dl className='flex flex-col divide-y divide-border border-t border-border'>
                {facts.map((fact) => (
                    <div className='flex flex-row items-baseline justify-between gap-4 py-2.5' key={fact.label}>
                        <dt className='text-xs text-muted'>{fact.label}</dt>
                        <dd className='min-w-0 truncate text-xs text-foreground tabular-nums' title={fact.value}>
                            {fact.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};

export default MarketplaceDetail;
