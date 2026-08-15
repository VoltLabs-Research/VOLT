import { cn } from '@heroui/react';
import { resolveInstallState } from '@/modules/plugin/components/marketplace/registry-version';

import type { RegistryPackageSummary } from '@volt/contracts/modules/plugin/registry';

interface MarketplaceRowProps {
    item: RegistryPackageSummary;
    installedVersion?: string;
    isSelected: boolean;
    onSelect: (item: RegistryPackageSummary) => void;
}

const MarketplaceRow = ({ item, installedVersion, isSelected, onSelect }: MarketplaceRowProps) => {
    const state = resolveInstallState(item.latest, installedVersion);

    return (
        <button
            type='button'
            role='option'
            aria-selected={isSelected}
            onClick={() => onSelect(item)}
            className={cn(
                'flex w-full cursor-pointer flex-row items-center gap-2 rounded-md border-0 px-3 py-2 text-left',
                isSelected ? 'bg-surface-hover' : 'bg-transparent hover:bg-surface-hover/60'
            )}
        >
            <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <span className='truncate text-sm text-foreground' title={item.name}>
                    {item.name}
                </span>
                <span className='truncate text-2xs text-muted'>
                    {`@${item.username}`}
                </span>
            </span>

            <span className='flex shrink-0 flex-col items-end gap-0.5'>
                {item.latest && (
                    <span className='text-2xs text-muted tabular-nums lining-nums'>{`v${item.latest}`}</span>
                )}
                {state === 'installed' && <span className='text-2xs text-muted'>Installed</span>}
                {state === 'update' && <span className='text-2xs text-accent'>Update</span>}
            </span>
        </button>
    );
};

export default MarketplaceRow;
