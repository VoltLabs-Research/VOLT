import { Button, openModal, closeModal } from '@voltstack/bravais';
import { Ban, Check, Copy, Download, FilePen, Pencil, Store, Upload } from 'lucide-react';
import { fetchPlugins, PLUGIN_QUERY_KEYS, useClonePluginMutation, useUpdatePluginMutation } from '@/modules/plugin/hooks/plugin/queries';
import useExportPlugin from '@/modules/plugin/hooks/plugin/use-export-plugin';
import { useDeletePluginMutation, useImportPluginMutation } from '@/modules/plugin/hooks/plugin/queries';
import RegistryBrowserModal, { REGISTRY_BROWSER_MODAL_ID } from '@/modules/plugin/components/listing/RegistryBrowserModal';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import { SOCKET_PLUGIN_EVENTS } from '@/modules/socket/events/plugin';
import { runAction } from '@/shared/ui/actions/run-action';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import useListingActions from '@/shared/ui/hooks/use-listing-actions';
import useTip from '@/shared/tips/use-tip';
import { dateColumn, statusColumn } from '@/shared/ui/utils/column-presets';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { useCallback, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { MenuIconProps, MenuOption } from '@/shared/contracts/menu';
import './PluginsListing.css';
import { useNavigate } from 'react-router-dom';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [SOCKET_PLUGIN_EVENTS.CREATED, SOCKET_PLUGIN_EVENTS.DELETED].map((event) => ({
    event,
    queryKeys: [PLUGIN_QUERY_KEYS.catalog(), PLUGIN_QUERY_KEYS.all(), PLUGIN_QUERY_KEYS.byId()]
}));

const CLONE_PLUGIN_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Cloning plugin...',
    success: 'Plugin cloned',
    error: 'Failed to clone plugin'
});

const IMPORT_PLUGIN_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Importing plugin...',
    success: 'Plugin imported',
    error: 'Failed to import plugin'
});

const DELETE_PLUGIN_TOAST_OPTIONS = createPromiseToastOptions({
    loading: 'Deleting plugin...',
    success: 'Plugin deleted',
    error: 'Failed to delete plugin'
});

interface PluginStatusAction {
    status: PluginStatus;
    label: string;
    icon: ComponentType<MenuIconProps>;
    loading: string;
    success: string;
}

const PLUGIN_STATUS_ACTIONS: PluginStatusAction[] = [
    {
        status: PluginStatus.PUBLISHED,
        label: 'Publish',
        icon: Check,
        loading: 'Publishing...',
        success: 'Plugin published'
    },
    {
        status: PluginStatus.DRAFT,
        label: 'Set as Draft',
        icon: FilePen,
        loading: 'Setting as draft...',
        success: 'Plugin set as draft'
    },
    {
        status: PluginStatus.DISABLED,
        label: 'Disable',
        icon: Ban,
        loading: 'Disabling...',
        success: 'Plugin disabled'
    }
];

const COLUMNS: ColumnConfig<Plugin>[] = [
    {
        key: 'modifier.name',
        title: 'Name',
        sortable: true,
        render: (_, plugin) => (
            <span className='text-sm font-medium plugin-name-link'>
                {plugin.modifier?.name}
            </span>
        ),
        skeleton: {
            variant: 'text',
            width: 160
        }
    },
    {
        key: 'modifier.version',
        title: 'Version',
        sortable: true,
        render: (_, plugin) => plugin.modifier?.version,
        skeleton: {
            variant: 'text',
            width: 70
        }
    },
    statusColumn<Plugin>('status', 'Status', {
        sortable: true,
        width: 80
    }),
    {
        key: 'exposures',
        title: 'Exposures',
        render: (_, plugin) => (
            <span className='text-xs font-semibold exposure-count'>
                {(plugin.exposures ?? []).length}
            </span>
        ),
        skeleton: {
            variant: 'text',
            width: 60
        }
    },
    dateColumn<Plugin>('createdAt', 'Created', { width: 100 })
];

const PluginsListing = () => {
    useTip('plugins-import-export');

    const navigate = useNavigate();
    const importInputRef = useRef<HTMLInputElement>(null);
    const [isRegistryOpen, setIsRegistryOpen] = useState(false);
    const selectedTeam = useSelectedTeam()!;
    const { canAccess } = useTeamPermissions();
    const canCreate = canAccess(['plugin:create']);
    const canUpdate = canAccess(['plugin:update']);

    const clonePluginMutation = useClonePluginMutation();
    const updatePluginMutation = useUpdatePluginMutation();
    const deletePluginMutation = useDeletePluginMutation();
    const exportPlugin = useExportPlugin();
    const importPluginMutation = useImportPluginMutation();

    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        try{
            await runAction({
                action: () => importPluginMutation.mutateAsync({ file }),
                toast: IMPORT_PLUGIN_TOAST_OPTIONS
            });
        }finally{
            importInputRef.current!.value = '';
        }
    }, [importPluginMutation]);

    const handleStatusChange = useCallback(async (plugin: Plugin, action: PluginStatusAction) => {
        await runAction({
            action: () => updatePluginMutation.mutateAsync({
                _id: plugin._id,
                status: action.status
            }),
            toast: createPromiseToastOptions({
                loading: action.loading,
                success: action.success,
                error: 'Failed to update plugin status'
            })
        });
    }, [updatePluginMutation]);

    const { getMenuOptions: getBaseMenuOptions } = useListingActions<Plugin>({
        actions: {
            edit: {
                label: 'Edit',
                icon: Pencil,
                handler: ({ item }) => navigate(`/plugins/builder?id=${item._id}`),
                requiredPermission: 'plugin:update'
            },
            clone: {
                label: 'Clone',
                icon: Copy,
                handler: async ({ item }) => {
                    await runAction({
                        action: () => clonePluginMutation.mutateAsync({
                            pluginId: item._id,
                            teamId: selectedTeam._id
                        }),
                        toast: CLONE_PLUGIN_TOAST_OPTIONS,
                        afterSuccess: (plugin) => navigate(`/plugins/builder?id=${plugin._id}`)
                    });
                },
                requiredPermission: 'plugin:create'
            },
            export: {
                label: 'Export',
                icon: Download,
                handler: ({ item }) => exportPlugin(item._id, `${item.modifier?.name || item._id}.zip`),
                requiredPermission: 'plugin:read'
            },
            delete: {
                handler: async ({ item }) => {
                    await runAction({
                        action: () => deletePluginMutation.mutateAsync({ _id: item._id }),
                        toast: DELETE_PLUGIN_TOAST_OPTIONS
                    });
                },
                confirm: ({ selectedItems }) => (selectedItems.length === 1
                    ? `Delete plugin "${selectedItems[0].modifier?.name || selectedItems[0]._id}"? This action cannot be undone.`
                    : `Delete ${selectedItems.length} plugins? This action cannot be undone.`),
                requiredPermission: 'plugin:delete'
            }
        }
    });

    const getMenuOptions = useCallback((item: Plugin, selectedItems: Plugin[]): MenuOption[] => {
        const baseOptions = getBaseMenuOptions(item, selectedItems);
        if(selectedItems.length > 1){
            return baseOptions;
        }

        const statusOptions: MenuOption[] = canUpdate
            ? PLUGIN_STATUS_ACTIONS
                .filter((action) => item.status !== action.status)
                .map((action) => ({
                    label: action.label,
                    icon: action.icon,
                    onClick: () => handleStatusChange(item, action)
                }))
            : [];

        return [
            ...baseOptions.filter((option) => !option.destructive),
            ...statusOptions,
            ...baseOptions.filter((option) => option.destructive)
        ];
    }, [getBaseMenuOptions, canUpdate, handleStatusChange]);

    return (
        <>
            <DocumentListing<Plugin>
                title='Plugins'
                queryKey={PLUGIN_QUERY_KEYS.catalog()}
                columns={COLUMNS}
                fetchData={fetchPlugins}
                defaultLimit={20}
                getMenuOptions={getMenuOptions}
                onItemClick={(plugin) => {
                    navigate(`/plugins/builder?id=${plugin._id}`);
                    return true;
                }}
                emptyMessage='No plugins found. Create your first plugin!'
                createNew={canCreate ? {
                    buttonTitle: 'New plugin',
                    onCreate: () => navigate('/plugins/builder')
                } : undefined}
                headerActions={canCreate && (
                    <>
                        <input
                            ref={importInputRef}
                            type='file'
                            accept='.zip'
                            onChange={handleImport}
                            style={{ display: 'none' }}
                        />
                        <Button
                            variant='toggle'
                            intent='neutral'
                            className='import-plugin-btn transition-[all] duration-150 ease-out-fluid'
                            onClick={() => importInputRef.current?.click()}
                            disabled={importPluginMutation.isPending}
                            isLoading={importPluginMutation.isPending}
                            leftIcon={<Upload size={18} />}
                        >
                            Import
                        </Button>
                        <Button
                            variant='toggle'
                            intent='neutral'
                            className='transition-[all] duration-150 ease-out-fluid'
                            onClick={() => {
                                setIsRegistryOpen(true);
                                openModal(REGISTRY_BROWSER_MODAL_ID);
                            }}
                            leftIcon={<Store size={18} />}
                        >
                            Browse registry
                        </Button>
                    </>
                )}
                socketInvalidation={SOCKET_INVALIDATION}
            />
            {canCreate && (
                <RegistryBrowserModal
                    isOpen={isRegistryOpen}
                    onClose={() => {
                        setIsRegistryOpen(false);
                        closeModal(REGISTRY_BROWSER_MODAL_ID);
                    }}
                />
            )}
        </>
    );
};

export default PluginsListing;
