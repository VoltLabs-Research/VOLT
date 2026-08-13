import Loader from '@/shared/ui/components/Loader';
import MarketplaceDetail from '@/modules/plugin/components/marketplace/MarketplaceDetail';
import MarketplaceRow from '@/modules/plugin/components/marketplace/MarketplaceRow';
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
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { Package } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { RegistryPackageSummary } from '@volt/contracts/modules/plugin/registry';

const SEARCH_DEBOUNCE_MS = 400;
const RESULTS_PER_PAGE = 30;
const INSTALLED_LOOKUP_LIMIT = 200;

/** Which package the detail pane is showing, so a reload or a shared link keeps it. */
const SELECTED_PACKAGE_PARAM = 'package';

const INSTALL_REGISTRY_PLUGIN_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Installing plugin onto a cluster...',
    success: 'Plugin installed',
    error: 'Failed to install plugin'
});

/*
 * Two panes: the registry on the left, one package on the right.
 *
 * The list used to carry each package's description and its Install button on one
 * clipped line, which made it both unreadable and a place to trigger a cluster
 * operation by mistake. Splitting them gives each half one job — the left is for
 * finding, the right is for reading and deciding — and lets the description be a
 * paragraph instead of a truncated sentence.
 *
 * Selection lives in the query string rather than in state: the pane survives a
 * reload, and the URL of a package is something you can send to someone.
 */
const MarketplacePage = () => {
    usePageTitle('Marketplace');

    const { canAccess } = useTeamPermissions();
    const canInstall = canAccess(['plugin:create']);

    const [searchParams, setSearchParams] = useSearchParams();
    const selectedFullName = searchParams.get(SELECTED_PACKAGE_PARAM);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [installingName, setInstallingName] = useState<string | null>(null);
    const installRegistryPlugin = useInstallRegistryPluginMutation();

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timeout);
    }, [search]);

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

    /*
     * Memoised because the `?? []` fallback is a fresh array on every render, which
     * would re-run the selection lookup below on renders where nothing changed.
     */
    const items = useMemo(() => data?.items ?? [], [data?.items]);

    /*
     * Resolved against the current results, so a selection that a new search no longer
     * returns falls back to the empty state instead of showing a package the list next
     * to it does not contain.
     */
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
        setInstallingName(item.fullName);
        try {
            await runAction({
                action: () => installRegistryPlugin.mutateAsync({ name: item.fullName }),
                toast: INSTALL_REGISTRY_PLUGIN_TOAST_OPTIONS
            });
        } finally {
            setInstallingName(null);
        }
    }, [installRegistryPlugin]);

    const renderListBody = () => {
        if (error) {
            return (
                <div className='p-3'>
                    <RecoveryState
                        title='Unable to reach the registry'
                        description={error.message}
                        tone={RecoveryStateTone.Error}
                    />
                </div>
            );
        }

        if (isFetching && items.length === 0) {
            return (
                <div className='flex flex-row items-center justify-center py-10' role='status'>
                    <Loader />
                    <span className='sr-only'>Loading registry results</span>
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <p className='px-3 py-10 text-center text-xs text-muted' aria-live='polite'>
                    {debouncedSearch ? `Nothing matches “${debouncedSearch}”.` : 'The registry returned nothing.'}
                </p>
            );
        }

        return (
            <div className='flex flex-col gap-px p-2' role='listbox' aria-label='Registry packages'>
                {items.map((item) => (
                    <MarketplaceRow
                        key={item.fullName}
                        item={item}
                        installedVersion={installedVersionByKey.get(item.name)}
                        isSelected={item.fullName === selectedFullName}
                        onSelect={selectPackage}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className='flex h-full w-full flex-row overflow-hidden'>
            {/*
             * Below the two-pane breakpoint the panes take turns: the list hides while a
             * package is open, and the detail pane's own back button returns to it. Two
             * columns in a phone's width would leave neither of them readable.
             */}
            <div
                className={cn(
                    'flex min-h-0 w-80 shrink-0 flex-col border-r border-border max-md:w-full',
                    selectedItem && 'max-md:hidden'
                )}
            >
                <div className='shrink-0 border-b border-border p-3'>
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        aria-label='Search the plugin registry'
                        fullWidth
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder='Search plugins…' />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                </div>

                {/* Only this column scrolls, so the search field stays put while you browse. */}
                <div className='min-h-0 flex-1 overflow-y-auto'>
                    {renderListBody()}
                </div>
            </div>

            <div
                className={cn(
                    'min-h-0 min-w-0 flex-1 overflow-y-auto',
                    !selectedItem && 'max-md:hidden'
                )}
            >
                {selectedItem ? (
                    <MarketplaceDetail
                        item={selectedItem}
                        installedVersion={installedVersionByKey.get(selectedItem.name)}
                        isInstalling={installingName === selectedItem.fullName}
                        isAnyInstalling={installingName !== null}
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
            </div>
        </div>
    );
};

export default MarketplacePage;
