import { Chip, cn } from '@heroui/react';
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
                'flex w-full cursor-pointer flex-row items-center gap-3 rounded-lg border-0 px-3 py-2.5 text-left transition-colors duration-150',
                isSelected ? 'bg-foreground/8' : 'bg-transparent hover:bg-foreground/4'
            )}
        >
            <span className='flex min-w-0 flex-1 flex-col'>
                <span className='truncate text-base font-medium text-foreground' title={item.name}>
                    {item.name}
                </span>
                <span className='truncate text-xs text-muted tabular-nums lining-nums'>
                    {item.latest ? `@${item.username} · v${item.latest}` : `@${item.username}`}
                </span>
            </span>

            {state === 'installed' && <Chip size='sm' variant='soft' className='px-2'>Installed</Chip>}
            {state === 'update' && <Chip size='sm' variant='soft' color='warning' className='px-2'>Update</Chip>}
        </button>
    );
};

export default MarketplaceRow;
