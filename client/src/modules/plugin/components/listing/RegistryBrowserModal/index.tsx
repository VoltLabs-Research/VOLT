import { Button, EmptyStateRoot, SearchField, Spinner } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import { useInstallRegistryPluginMutation, usePluginsCatalogQuery, useRegistrySearchQuery } from '@/modules/plugin/hooks/plugin/queries';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import semver from 'semver';
import type { RegistryPackageSummary } from '@volt/contracts/modules/plugin/registry';

export const REGISTRY_BROWSER_MODAL_ID = 'plugin-registry-browser-modal';

interface RegistryBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const INSTALL_REGISTRY_PLUGIN_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Installing plugin onto a cluster...',
    success: 'Plugin installed',
    error: 'Failed to install plugin'
});

const isNewerVersion = (latest: string, installed: string): boolean => {
    const left = semver.coerce(latest, { includePrerelease: true }) ?? semver.coerce(latest);
    const right = semver.coerce(installed, { includePrerelease: true }) ?? semver.coerce(installed);

    if (!left || !right) return false;

    return semver.gt(left, right);
};

interface RegistryResultCardProps {
    item: RegistryPackageSummary;
    installedVersion?: string;
    isInstalling: boolean;
    isAnyInstalling: boolean;
    onInstall: (item: RegistryPackageSummary) => void;
}

const RegistryResultCard = ({ item, installedVersion, isInstalling, isAnyInstalling, onInstall }: RegistryResultCardProps) => {
    const updatable = installedVersion !== undefined && !!item.latest && isNewerVersion(item.latest, installedVersion);
    const isInstalled = installedVersion !== undefined && !updatable;

    return (
        <div className='flex flex-row items-center gap-3 rounded-[0.625rem] p-3 transition-colors duration-200 ease-out-fluid hover:bg-surface-tertiary'>
            <span className='flex size-11 shrink-0 flex-row items-center justify-center rounded-[0.625rem] bg-[rgba(127,127,127,0.14)]'>
                <Package size={22} aria-hidden='true' />
            </span>
            <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                    {item.name}{item.latest ? ` v${item.latest}` : ''}
                </p>
                {item.description && (
                    <p className='line-clamp-2 text-xs text-muted'>
                        {item.description}
                    </p>
                )}
            </div>
            <Button
                variant={updatable ? 'primary' : 'secondary'}
                className='shrink-0'
                onPress={() => onInstall(item)}
                isPending={isInstalling}
                isDisabled={isInstalled || isAnyInstalling}
            >
                {isInstalled ? 'Installed' : updatable ? 'Update' : 'Install'}
            </Button>
        </div>
    );
};

const RegistryBrowserModal = ({ isOpen, onClose }: RegistryBrowserModalProps) => {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [installingName, setInstallingName] = useState<string | null>(null);
    const installRegistryPlugin = useInstallRegistryPluginMutation();

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 400);
        return () => clearTimeout(timeout);
    }, [search]);

    const { data, isFetching } = useRegistrySearchQuery(
        {
            q: debouncedSearch,
            page: 1,
            limit: 30
        },
        { enabled: isOpen }
    );

    const items = data?.items ?? [];

    const installedQuery = usePluginsCatalogQuery({
        page: 1,
        limit: 200
    }, { enabled: isOpen });
    const installedVersionByKey = useMemo(() => {
        const map = new Map<string, string>();
        for (const plugin of installedQuery.data?.data ?? []) {
            if (plugin.modifier?.key) map.set(plugin.modifier.key, plugin.modifier.version ?? '');
        }
        return map;
    }, [installedQuery.data]);

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

    return (
        <Modal
            id={REGISTRY_BROWSER_MODAL_ID}
            title='Browse registry'
            description='Search registry.voltcloud.dev and install a workflow plugin onto a compute cluster.'
            onClose={onClose}
            width='960px'
        >
            <div className='flex flex-col gap-4'>
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
                <div className='h-[460px] overflow-y-auto'>
                    {isFetching && (
                        <div className='flex flex-row items-center justify-center p-8' role='status'>
                            <Spinner />
                            <span className='sr-only'>Loading registry results</span>
                        </div>
                    )}

                    {!isFetching && items.length === 0 && (
                        <EmptyStateRoot className='flex flex-col items-center justify-center gap-2 p-8 text-center'>
                            <span className='sr-only' aria-live='polite' aria-atomic='true'>No plugins found</span>
                            <h3 className='text-base font-medium text-foreground'>No plugins found</h3>
                        </EmptyStateRoot>
                    )}

                    {!isFetching && items.length > 0 && (
                        <div className='grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2'>
                            {items.map((item) => (
                                <RegistryResultCard
                                    key={item.fullName}
                                    item={item}
                                    installedVersion={installedVersionByKey.get(item.name)}
                                    isInstalling={installingName === item.fullName}
                                    isAnyInstalling={installingName !== null}
                                    onInstall={handleInstall}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default RegistryBrowserModal;
