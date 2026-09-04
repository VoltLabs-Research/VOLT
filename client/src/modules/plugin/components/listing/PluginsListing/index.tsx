import { Button } from '@heroui/react';
import { Ban, Check, Copy, Download, FilePen, Pencil, Upload } from 'lucide-react';
import { fetchPlugins, PLUGIN_QUERY_KEYS, useClonePluginMutation, useUpdatePluginMutation } from '@/modules/plugin/hooks/plugin/queries';
import useExportPlugin from './use-export-plugin';
import { useDeletePluginMutation, useImportPluginMutation } from '@/modules/plugin/hooks/plugin/queries';
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
import { createListingDeleteConfirmation } from '@/shared/ui/utils/listing-messages';
import { useCallback, useRef } from 'react';
import type { ComponentType } from 'react';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { MenuIconProps, MenuOption } from '@/shared/contracts/menu';
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
            <span className='text-sm font-medium text-foreground transition-colors duration-150 ease-out-fluid hover:text-accent'>
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
            <span className='min-w-6 rounded-lg bg-default px-1.5 py-0.5 text-xs font-semibold'>
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
                pluginId: plugin._id,
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
                handler: ({ item }) => exportPlugin({
                    pluginId: item._id,
                    filename: `${item.modifier?.name || item._id}.zip`
                }),
                requiredPermission: 'plugin:read'
            },
            delete: {
                handler: async ({ item }) => {
                    await runAction({
                        action: () => deletePluginMutation.mutateAsync({ pluginId: item._id }),
                        toast: DELETE_PLUGIN_TOAST_OPTIONS
                    });
                },
                confirm: ({ selectedItems }) => createListingDeleteConfirmation<Plugin>({
                    singularName: 'plugin',
                    pluralName: 'plugins',
                    untitledLabel: 'Untitled Plugin',
                    getTitle: (plugin) => plugin.modifier?.name ?? plugin._id
                })(selectedItems),
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
                            variant='ghost'
                            className='transition-colors duration-150 ease-out-fluid'
                            onPress={() => importInputRef.current?.click()}
                            isDisabled={importPluginMutation.isPending}
                            isPending={importPluginMutation.isPending}
                        >
                            <Upload size={18} aria-hidden='true' />
                            Import
                        </Button>
                    </>
                )}
                socketInvalidation={SOCKET_INVALIDATION}
            />
        </>
    );
};

export default PluginsListing;
