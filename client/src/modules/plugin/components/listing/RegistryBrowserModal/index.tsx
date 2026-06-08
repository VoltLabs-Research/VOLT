import { Box, Button, EmptyState, Loader, Modal, Row, SearchInput, Stack, Text } from '@voltstack/bravais';
import { useInstallRegistryPluginMutation, useRegistrySearchQuery } from '@/modules/plugin/hooks/plugin/queries';
import { runAction } from '@/shared/presentation/actions/run-action';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { useCallback, useEffect, useState } from 'react';
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
        { q: debouncedSearch, page: 1, limit: 20 },
        { enabled: isOpen }
    );

    const items = data?.items ?? [];

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
            width='720px'
        >
            <Stack gap='1' className='p-1-5'>
                <SearchInput
                    placeholder='Search plugins…'
                    value={search}
                    aria-label='Search the plugin registry'
                    onChange={(e) => setSearch(e.target.value)}
                />

                {isFetching && (
                    <Box p='2'>
                        <Loader scale={0.5} isFixed={false} announce />
                    </Box>
                )}

                {!isFetching && items.length === 0 && (
                    <EmptyState title='No plugins found' description='' announce />
                )}

                {!isFetching && items.length > 0 && (
                    <Stack gap='05'>
                        {items.map((item) => (
                            <Row key={item.fullName} gap='1' justify='between' align='center' className='list-item-hoverable p-075 radius-sm'>
                                <Stack gap='025'>
                                    <Text as='p' size='md' weight='medium'>
                                        {item.name}{item.latest ? ` v${item.latest}` : ''}
                                    </Text>
                                    {item.description && (
                                        <Text as='p' size='sm' tone='muted'>{item.description}</Text>
                                    )}
                                </Stack>
                                <Button
                                    variant='toggle'
                                    intent='neutral'
                                    onClick={() => handleInstall(item)}
                                    isLoading={installingName === item.fullName}
                                    disabled={installingName !== null}
                                >
                                    Install
                                </Button>
                            </Row>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Modal>
    );
};

export default RegistryBrowserModal;
