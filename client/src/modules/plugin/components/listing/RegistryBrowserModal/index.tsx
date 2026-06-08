import './RegistryBrowserModal.css';
import { Box, Button, EmptyState, Loader, Modal, SearchInput, Stack, Text } from '@voltstack/bravais';
import { useInstallRegistryPluginMutation, usePluginsCatalogQuery, useRegistrySearchQuery } from '@/modules/plugin/hooks/plugin/queries';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import type { RegistryPackageSummary } from '@/modules/plugin/api/entities/plugin/registry';

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
    const segments = (version: string): number[] =>
        version.split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
    const left = segments(latest);
    const right = segments(installed);
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const diff = (left[index] ?? 0) - (right[index] ?? 0);
        if (diff !== 0) return diff > 0;
    }
    return false;
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
        { q: debouncedSearch, page: 1, limit: 30 },
        { enabled: isOpen }
    );

    const items = data?.items ?? [];

    const installedQuery = usePluginsCatalogQuery({ page: 1, limit: 200 }, { enabled: isOpen });
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
            <Stack gap='1' className='p-1-5'>
                <SearchInput
                    placeholder='Search plugins…'
                    value={search}
                    aria-label='Search the plugin registry'
                    onChange={(e) => setSearch(e.target.value)}
                />

                <div className='registry-results'>
                    {isFetching && (
                        <Box p='2'>
                            <Loader scale={0.5} isFixed={false} announce />
                        </Box>
                    )}

                    {!isFetching && items.length === 0 && (
                        <EmptyState title='No plugins found' description='' announce />
                    )}

                    {!isFetching && items.length > 0 && (
                        <div className='registry-grid'>
                            {items.map((item) => (
                                <div key={item.fullName} className='registry-card list-item-hoverable'>
                                    <span className='registry-card__icon'>
                                        <Package size={22} />
                                    </span>
                                    <div className='registry-card__body'>
                                        <Text as='p' size='md' weight='medium' truncate>
                                            {item.name}{item.latest ? ` v${item.latest}` : ''}
                                        </Text>
                                        {item.description && (
                                            <Text as='p' size='sm' tone='muted' className='registry-card__desc'>
                                                {item.description}
                                            </Text>
                                        )}
                                    </div>
                                    {(() => {
                                        const installedVersion = installedVersionByKey.get(item.name);
                                        const updatable = installedVersion !== undefined
                                            && !!item.latest
                                            && isNewerVersion(item.latest, installedVersion);
                                        if (installedVersion !== undefined && !updatable) {
                                            return (
                                                <Button variant='toggle' intent='neutral' className='registry-card__action' disabled>
                                                    Installed
                                                </Button>
                                            );
                                        }
                                        return (
                                            <Button
                                                variant='toggle'
                                                intent={updatable ? 'brand' : 'neutral'}
                                                className='registry-card__action'
                                                onClick={() => handleInstall(item)}
                                                isLoading={installingName === item.fullName}
                                                disabled={installingName !== null}
                                            >
                                                {updatable ? 'Update' : 'Install'}
                                            </Button>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Stack>
        </Modal>
    );
};

export default RegistryBrowserModal;
