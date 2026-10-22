import { Button, Chip } from '@heroui/react';
import { Fragment } from 'react';
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
            ? { label: 'Installed version', value: installedVersion }
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
        <div className='flex flex-col gap-6 rounded-3xl bg-foreground/4 p-6 max-md:p-5'>
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
                        <h3 className='text-xl font-semibold text-foreground'>{item.name}</h3>
                        <span className='text-sm text-muted'>{`@${item.username}`}</span>
                    </div>

                    {state === 'installed' ? (
                        <span className='shrink-0 text-sm text-muted'>Installed</span>
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
                    <p className='max-w-prose text-base leading-relaxed text-foreground'>{item.description}</p>
                )}
            </div>

            {item.keywords && item.keywords.length > 0 && (
                <div className='flex flex-row flex-wrap gap-1'>
                    {item.keywords.map((keyword) => (
                        <Chip
                            variant='tertiary'
                            className='text-muted ring-1 ring-inset ring-foreground/10'
                            key={keyword}
                        >
                            {keyword}
                        </Chip>
                    ))}
                </div>
            )}

            <dl className='grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-base'>
                {facts.map((fact) => (
                    <Fragment key={fact.label}>
                        <dt className='text-muted'>{fact.label}</dt>
                        <dd className='min-w-0 text-foreground tabular-nums [overflow-wrap:anywhere]'>
                            {fact.value}
                        </dd>
                    </Fragment>
                ))}
            </dl>
        </div>
    );
};

export default MarketplaceDetail;
