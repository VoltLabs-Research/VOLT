import { RiEditLine, RiFileCopyLine, RiDownloadLine, RiUploadLine, RiCheckLine, RiDraftLine, RiForbidLine } from 'react-icons/ri';
import { fetchPlugins, PLUGIN_QUERY_KEYS, useClonePluginMutation, useUpdatePluginMutation } from '@/modules/plugin/hooks/plugin/queries';
import useDeletePlugin from '@/modules/plugin/hooks/plugin/use-delete-plugin';
import useExportPlugin from '@/modules/plugin/hooks/plugin/use-export-plugin';
import useImportPlugin from '@/modules/plugin/hooks/plugin/use-import-plugin';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { runAction } from '@/shared/presentation/actions/run-action';
import Button from '@/shared/presentation/components/Button';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { dateColumn, statusColumn } from '@/shared/presentation/utilities/column-presets';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GetPluginsInputDTO } from '@/modules/plugin/api/dtos/plugin/get-plugins';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { ColumnConfig, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { MenuOption } from '@/shared/presentation/types/menu';
import './PluginsListing.css';

interface PluginListingRow extends BaseEntity {
    modifier?: Plugin['modifier'];
    exposures?: Plugin['exposures'];
};

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'plugin.created', queryKeys: [PLUGIN_QUERY_KEYS.catalog(), PLUGIN_QUERY_KEYS.all(), PLUGIN_QUERY_KEYS.byId()] },
    { event: 'plugin.deleted', queryKeys: [PLUGIN_QUERY_KEYS.catalog(), PLUGIN_QUERY_KEYS.all(), PLUGIN_QUERY_KEYS.byId()] }
];

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

const PluginsListing = () => {
    const navigate = useNavigate();
    const importInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const selectedTeam = useSelectedTeam()!;
    const canCreate = usePermission(['plugin:create']);
    const canUpdate = usePermission(['plugin:update']);

    const clonePluginMutation = useClonePluginMutation();
    const updatePluginMutation = useUpdatePluginMutation();
    const deletePlugin = useDeletePlugin();
    const exportPlugin = useExportPlugin();
    const importPlugin = useImportPlugin();

    const fetchData = useCallback(async (params: GetPluginsInputDTO) => {
        return await fetchPlugins(params);
    }, []);

    const handleClone = useCallback(async (item: Plugin) => {
        const clonedPlugin = await runAction({
            action: () => clonePluginMutation.mutateAsync({
                pluginId: item._id,
                teamId: selectedTeam._id
            }),
            toast: CLONE_PLUGIN_TOAST_OPTIONS,
            afterSuccess: (plugin) => {
                navigate(`/plugins/builder?id=${plugin._id}`);
            }
        });

        return clonedPlugin;
    }, [clonePluginMutation, selectedTeam._id, navigate]);

    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        setIsImporting(true);
        try{
            await runAction({
                action: () => importPlugin(file),
                toast: IMPORT_PLUGIN_TOAST_OPTIONS
            });
        }finally{
            setIsImporting(false);
            importInputRef.current!.value = '';
        }
    }, [importPlugin]);

    const handleStatusChange = useCallback(async (plugin: Plugin, newStatus: PluginStatus) => {
        const statusLabels: Record<PluginStatus, string> = {
            [PluginStatus.PUBLISHED]: 'Publishing',
            [PluginStatus.DRAFT]: 'Setting as draft',
            [PluginStatus.DISABLED]: 'Disabling'
        };
        const successLabels: Record<PluginStatus, string> = {
            [PluginStatus.PUBLISHED]: 'Plugin published',
            [PluginStatus.DRAFT]: 'Plugin set as draft',
            [PluginStatus.DISABLED]: 'Plugin disabled'
        };
        await runAction({
            action: () => updatePluginMutation.mutateAsync({ _id: plugin._id, status: newStatus }),
            toast: createPromiseToastOptions({
                loading: `${statusLabels[newStatus]}...`,
                success: successLabels[newStatus],
                error: 'Failed to update plugin status'
            })
        });
    }, [updatePluginMutation]);

    const buildDeleteConfirmationMessage = useCallback((selectedItems: Plugin[]) => {
        let confirmationMessage = `Delete ${selectedItems.length} plugins? This action cannot be undone.`;

        if (selectedItems.length === 1) {
            confirmationMessage = `Delete plugin "${selectedItems[0].modifier?.name || selectedItems[0]._id}"? This action cannot be undone.`;
        }

        return confirmationMessage;
    }, []);

    const triggerImportFileSelect = useCallback(() => {
        importInputRef.current?.click();
    }, []);

    const { getMenuOptions: getBaseMenuOptions } = useListingActions<Plugin>({
        actions: {
            edit: {
                label: 'Edit',
                icon: RiEditLine,
                handler: ({ item }) => navigate(`/plugins/builder?id=${item._id}`),
                requiredPermission: 'plugin:update'
            },
            clone: {
                label: 'Clone',
                icon: RiFileCopyLine,
                handler: async ({ item }) => {
                    await handleClone(item);
                },
                requiredPermission: 'plugin:create'
            },
            export: {
                label: 'Export',
                icon: RiDownloadLine,
                handler: ({ item }) => exportPlugin(item._id, `${item.modifier?.name || item._id}.zip`),
                requiredPermission: 'plugin:read'
            },
            delete: {
                handler: async ({ item }) => {
                    await runAction({
                        action: () => deletePlugin(item._id),
                        toast: DELETE_PLUGIN_TOAST_OPTIONS
                    });
                },
                confirm: ({ selectedItems }) => buildDeleteConfirmationMessage(selectedItems),
                requiredPermission: 'plugin:delete'
            }
        }
    });

    const getPluginStatusMenuOptions = useCallback((item: Plugin): MenuOption[] => {
        if (!canUpdate) {
            return [];
        }

        const statusActions: MenuOption[] = [];
        if(item.status !== PluginStatus.PUBLISHED){
            statusActions.push({
                label: 'Publish',
                icon: RiCheckLine,
                onClick: () => handleStatusChange(item, PluginStatus.PUBLISHED)
            });
        }
        if(item.status !== PluginStatus.DRAFT){
            statusActions.push({
                label: 'Set as Draft',
                icon: RiDraftLine,
                onClick: () => handleStatusChange(item, PluginStatus.DRAFT)
            });
        }
        if(item.status !== PluginStatus.DISABLED){
            statusActions.push({
                label: 'Disable',
                icon: RiForbidLine,
                onClick: () => handleStatusChange(item, PluginStatus.DISABLED)
            });
        }

        return statusActions;
    }, [canUpdate, handleStatusChange]);

    const getMenuOptions = useCallback((item: Plugin, selectedItems: Plugin[]): MenuOption[] => {
        const baseOptions = getBaseMenuOptions(item, selectedItems);
        if(selectedItems.length > 1){
            return baseOptions;
        }

        const deleteOption = baseOptions.filter((option) => option.destructive);
        const nonDeleteOptions = baseOptions.filter((option) => !option.destructive);
        return [...nonDeleteOptions, ...getPluginStatusMenuOptions(item), ...deleteOption];
    }, [getBaseMenuOptions, getPluginStatusMenuOptions]);

    let createNewConfig: { buttonTitle: string; onCreate: () => void } | undefined;
    if (canCreate) {
        createNewConfig = {
            buttonTitle: 'New plugin',
            onCreate: () => navigate('/plugins/builder')
        };
    }

    let headerActions: React.ReactNode;
    if (canCreate) {
        headerActions = (
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
                    intent='neutral'
                    className='import-plugin-btn transition-fast'
                    onClick={triggerImportFileSelect}
                    disabled={isImporting}
                    isLoading={isImporting}
                    leftIcon={<RiUploadLine size={18} />}
                >
                    Import
                </Button>
            </>
        );
    }

    const columns: ColumnConfig<Plugin>[] = useMemo(() => [
        {
            key: 'modifier.name',
            title: 'Name',
            sortable: true,
            render: (_, row) => {
                const plugin = row as PluginListingRow;
                return (
                    <span
                        className='plugin-name-link font-size-2 font-weight-5 cursor-pointer'
                        onClick={() => navigate(`/plugins/builder?id=${plugin._id}`)}
                    >
                        {plugin.modifier!.name}
                    </span>
                );
            },
            skeleton: { variant: 'text', width: 160 }
        },
        {
            key: 'modifier.version',
            title: 'Version',
            sortable: true,
            render: (_, row) => (row as PluginListingRow).modifier?.version,
            skeleton: { variant: 'text', width: 70 }
        },
        statusColumn<Plugin>('status', 'Status', {
            sortable: true,
            width: 80
        }),
        {
            key: 'exposures',
            title: 'Exposures',
            render: (_, row) => (
                <span className='exposure-count font-size-1 font-weight-6'>
                    {((row as PluginListingRow).exposures ?? []).length}
                </span>
            ),
            skeleton: { variant: 'text', width: 60 }
        },
        dateColumn<Plugin>('createdAt', 'Created', { width: 100 })
    ], [navigate]);

    return (
        <DocumentListing<Plugin>
            title='Plugins'
            queryKey={PLUGIN_QUERY_KEYS.catalogList({ page: 1, limit: 20 })}
            columns={columns}
            fetchData={fetchData}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No plugins found. Create your first plugin!'
            createNew={createNewConfig}
            headerActions={headerActions}
            socketInvalidation={SOCKET_INVALIDATION}
        />
    );
};

export default PluginsListing;
