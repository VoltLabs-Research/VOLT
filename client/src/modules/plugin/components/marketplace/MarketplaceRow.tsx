import { Button } from '@heroui/react';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { resolveInstallState } from '@/modules/plugin/components/marketplace/registry-version';

import type { RegistryPackageSummary } from '@volt/contracts/modules/plugin/registry';

const compactCount = (value: number): string => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
    return String(value);
};

interface MarketplaceRowProps {
    item: RegistryPackageSummary;
    installedVersion?: string;
    isInstalling: boolean;
    /** Installs land on a cluster one at a time. */
    isAnyInstalling: boolean;
    canInstall: boolean;
    onInstall: (item: RegistryPackageSummary) => void;
}

/*
 * One package, as a row.
 *
 * Everything the registry knows about a package sits on two lines: the name and
 * the action on the first, the rest as one muted line under it. No card, no icon
 * tile, no keyword chips — for a list you scan top to bottom, that chrome only
 * competes with the names.
 *
 * Facts the registry did not return are omitted rather than filled in: a zero
 * download count would read as a measurement.
 */
const MarketplaceRow = ({
    item,
    installedVersion,
    isInstalling,
    isAnyInstalling,
    canInstall,
    onInstall
}: MarketplaceRowProps) => {
    const state = resolveInstallState(item.latest, installedVersion);
    const downloads = item.downloads?.last30d ?? item.downloads?.total;
    const updated = item.updatedAt ? formatCompactRelativeTime(item.updatedAt) : undefined;

    const meta = [
        item.description,
        `@${item.username}`,
        downloads === undefined ? undefined : `${compactCount(downloads)} downloads`,
        updated === undefined ? undefined : `updated ${updated}`
    ].filter((part): part is string => Boolean(part)).join(' · ');

    return (
        <div className='flex flex-row items-center gap-4 border-b border-border py-3'>
            <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <span className='flex min-w-0 flex-row items-baseline gap-2'>
                    <span className='truncate text-sm font-medium text-foreground' title={item.name}>
                        {item.name}
                    </span>
                    {item.latest && (
                        <span className='tabular-nums lining-nums shrink-0 text-2xs text-muted'>
                            {`v${item.latest}`}
                        </span>
                    )}
                </span>
                <span className='truncate text-2xs text-muted' title={meta}>{meta}</span>
            </div>

            {state === 'installed' ? (
                <span
                    className='shrink-0 text-2xs text-muted'
                    title={installedVersion ? `Installed v${installedVersion}` : 'Installed'}
                >
                    Installed
                </span>
            ) : (
                // A disabled control needs a reason, and the two reasons differ.
                <span
                    className='inline-flex shrink-0'
                    title={canInstall
                        ? (isAnyInstalling && !isInstalling ? 'Another install is running' : undefined)
                        : 'You do not have permission to install plugins.'}
                >
                    <Button
                        size='sm'
                        variant={state === 'update' ? 'primary' : 'ghost'}
                        onPress={() => onInstall(item)}
                        isPending={isInstalling}
                        isDisabled={!canInstall || isAnyInstalling}
                        aria-label={`${state === 'update' ? 'Update' : 'Install'} ${item.name}`}
                    >
                        {state === 'update' ? 'Update' : 'Install'}
                    </Button>
                </span>
            )}
        </div>
    );
};

export default MarketplaceRow;
