import Loader from '@/shared/ui/components/Loader';
import MarketplaceRow from '@/modules/plugin/components/marketplace/MarketplaceRow';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { SearchField } from '@heroui/react';
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
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { RegistryPackageSummary } from '@volt/contracts/modules/plugin/registry';

const SEARCH_DEBOUNCE_MS = 400;
const RESULTS_PER_PAGE = 30;
const INSTALLED_LOOKUP_LIMIT = 200;

const INSTALL_REGISTRY_PLUGIN_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Installing plugin onto a cluster...',
    success: 'Plugin installed',
    error: 'Failed to install plugin'
});

/*
 * The registry as a plain list: search, then rows.
 *
 * It replaced a modal over the plugins listing. A dialog was the wrong container
 * for something you read and compare, and there is nothing here that needs a
 * card or a grid — the names are the content.
 */
const MarketplacePage = () => {
    usePageTitle('Marketplace');

    const { canAccess } = useTeamPermissions();
    const canInstall = canAccess(['plugin:create']);

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

    const items = data?.items ?? [];

    return (
        <div className='mx-auto flex h-full w-full max-w-[52rem] flex-col gap-6 p-8 max-md:gap-4 max-md:px-4 max-md:pt-5'>
            <div className='flex flex-col gap-4'>
                <h3 className='text-xl font-medium text-foreground'>Marketplace</h3>

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

            <div className='min-h-0 flex-1 overflow-y-auto'>
                {error ? (
                    <RecoveryState
                        title='Unable to reach the registry'
                        description={error.message}
                        tone={RecoveryStateTone.Error}
                    />
                ) : isFetching && items.length === 0 ? (
                    <div className='flex flex-row items-center justify-center py-10' role='status'>
                        <Loader />
                        <span className='sr-only'>Loading registry results</span>
                    </div>
                ) : items.length === 0 ? (
                    <p className='py-10 text-center text-xs text-muted' aria-live='polite'>
                        {debouncedSearch ? `Nothing matches “${debouncedSearch}”.` : 'The registry returned nothing.'}
                    </p>
                ) : (
                    <div className='flex flex-col'>
                        {items.map((item) => (
                            <MarketplaceRow
                                key={item.fullName}
                                item={item}
                                installedVersion={installedVersionByKey.get(item.name)}
                                isInstalling={installingName === item.fullName}
                                isAnyInstalling={installingName !== null}
                                canInstall={canInstall}
                                onInstall={handleInstall}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketplacePage;
