import useDebouncedValue from '@/shared/ui/hooks/use-debounced-value';
import MarketplaceDetail from '@/modules/plugin/components/marketplace/MarketplaceDetail';
import MarketplaceRow, { MarketplaceRowSkeleton } from '@/modules/plugin/components/marketplace/MarketplaceRow';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { SearchField, cn } from '@heroui/react';
import { buildInstalledVersionIndex } from '@/modules/plugin/components/marketplace/registry-version';
import {
    useInstallRegistryPluginMutation,
    usePluginsCatalogQuery,
    useRegistrySearchQuery
} from '@/modules/plugin/hooks/plugin/queries';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import useTeamAccess from '@/modules/team/hooks/team/use-team-access';
import { Package } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { RegistryPackageSummary } from '@volt/contracts/modules/plugin/registry';
import Scrollable from '@/shared/ui/components/Scrollable';
import { TeamAccess, TeamArea } from '@volt/contracts/modules/team/access';

const SEARCH_DEBOUNCE_MS = 400;
const RESULTS_PER_PAGE = 30;
const INSTALLED_LOOKUP_LIMIT = 200;

const SELECTED_PACKAGE_PARAM = 'package';
// Plugin names of a few typical lengths, for the rows shown while the registry answers.
const ROW_SKELETON_NAME_WIDTHS = ['62%', '48%', '70%', '55%', '40%', '66%', '52%', '45%'];

const INSTALL_REGISTRY_PLUGIN_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Installing plugin onto a cluster...',
    success: 'Plugin installed',
    error: 'Failed to install plugin'
});

const MarketplacePage = () => {
    usePageTitle('Marketplace');

    const { can } = useTeamAccess();
    const canInstall = can(TeamArea.Plugin, TeamAccess.Write);

    const [searchParams, setSearchParams] = useSearchParams();
    const selectedFullName = searchParams.get(SELECTED_PACKAGE_PARAM);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
    // Tracked per package so one install only locks its own button.
    const [installingNames, setInstallingNames] = useState<ReadonlySet<string>>(() => new Set());
    const installRegistryPlugin = useInstallRegistryPluginMutation();

    const { data, isFetching, error } = useRegistrySearchQuery({
        q: debouncedSearch,
        page: 1,
        limit: RESULTS_PER_PAGE
    });

    const installedQuery = usePluginsCatalogQuery({
        page: 1,
        limit: INSTALLED_LOOKUP_LIMIT
    });

    const installedVersionByKey = useMemo(
        () => buildInstalledVersionIndex(installedQuery.data?.data ?? []),
        [installedQuery.data]
    );

    const items = useMemo(() => data?.items ?? [], [data?.items]);

    const selectedItem = useMemo(() => {
        if (!selectedFullName) return undefined;
        return items.find((item) => item.fullName === selectedFullName);
    }, [items, selectedFullName]);

    const selectPackage = useCallback((item: RegistryPackageSummary) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set(SELECTED_PACKAGE_PARAM, item.fullName);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const clearSelection = useCallback(() => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete(SELECTED_PACKAGE_PARAM);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const handleInstall = useCallback(async (item: RegistryPackageSummary) => {
        const name = item.fullName;
        if (installingNames.has(name)) return;

        setInstallingNames((current) => new Set(current).add(name));
        try {
            await runAction({
                action: () => installRegistryPlugin.mutateAsync({ name }),
                toast: INSTALL_REGISTRY_PLUGIN_TOAST_OPTIONS
            });
        } finally {
            setInstallingNames((current) => {
                const next = new Set(current);
                next.delete(name);
                return next;
            });
        }
    }, [installRegistryPlugin, installingNames]);

    const renderListBody = () => {
        if (error) {
            return (
                <RecoveryState
                    title='Unable to reach the registry'
                    description={error.message}
                    tone={RecoveryStateTone.Error}
                />
            );
        }

        if (isFetching && items.length === 0) {
            return (
                <div className='flex flex-col gap-0.5' role='status' aria-label='Loading registry results'>
                    {ROW_SKELETON_NAME_WIDTHS.map((width, index) => (
                        <MarketplaceRowSkeleton key={index} nameWidth={width} />
                    ))}
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <p className='px-3 py-10 text-center text-sm text-muted' aria-live='polite'>
                    {debouncedSearch ? `Nothing matches “${debouncedSearch}”.` : 'The registry returned nothing.'}
                </p>
            );
        }

        return (
            <div className='flex flex-col gap-0.5' role='listbox' aria-label='Registry packages'>
                {items.map((item) => (
                    <MarketplaceRow
                        key={item.fullName}
                        item={item}
                        installedVersion={installedVersionByKey.get(item.name)}
                        isSelected={item.fullName === selectedFullName}
                        isInstalling={installingNames.has(item.fullName)}
                        onSelect={selectPackage}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className='mx-auto flex h-full w-full max-w-7xl flex-row gap-4 overflow-hidden px-6 pt-3 pb-6'>
            <div
                className={cn(
                    'flex min-h-0 w-80 shrink-0 flex-col gap-3 max-md:w-full',
                    selectedItem && 'max-md:hidden'
                )}
            >
                <div className='shrink-0'>
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        aria-label='Search the plugin registry'
                        fullWidth
                    >
                        <SearchField.Group className='rounded-full border-0 bg-foreground/5 hover:bg-foreground/8 focus-within:bg-foreground/8'>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder='Search plugins…' />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                </div>

                <Scrollable className='min-h-0 flex-1'>
                    {renderListBody()}
                </Scrollable>
            </div>

            <Scrollable
                className={cn(
                    'min-h-0 min-w-0 flex-1',
                    !selectedItem && 'max-md:hidden'
                )}
            >
                {selectedItem ? (
                    <MarketplaceDetail
                        item={selectedItem}
                        installedVersion={installedVersionByKey.get(selectedItem.name)}
                        isInstalling={installingNames.has(selectedItem.fullName)}
                        canInstall={canInstall}
                        onInstall={handleInstall}
                        onBack={clearSelection}
                    />
                ) : (
                    <div className='flex h-full items-center justify-center p-8'>
                        <RecoveryState
                            title='No plugin selected'
                            description='Pick a plugin from the list to see what it does, who publishes it, and whether you already have it installed.'
                            tone={RecoveryStateTone.Empty}
                            icon={<Package size={20} />}
                        />
                    </div>
                )}
            </Scrollable>
        </div>
    );
};

export default MarketplacePage;
