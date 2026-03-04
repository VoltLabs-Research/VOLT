import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiEditLine, RiFileCopyLine, RiDownloadLine, RiUploadLine, RiCheckLine, RiDraftLine, RiForbidLine } from 'react-icons/ri';
import { usePluginUseCases, useDeletePlugin, useExportPlugin, useImportPlugin } from '../../../hooks';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { showPromise } from '@/shared/presentation/hooks/toast';
import DocumentListing, { type ColumnConfig, createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Button from '@/shared/presentation/components/Button';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import type { GetPluginsInputDTO } from '@/modules/plugin/application/dtos';
import type { Plugin } from '../../../../domain/entities';
import { PluginStatus } from '../../../../domain/entities/Workflow';
import type { MenuOption } from '@/shared/presentation/components/DocumentListingTable';
import { dateColumn } from '@/shared/presentation/utils/column-presets';
import './PluginsListing.css';

const LIST_SYNC = createListSyncConfig('plugin');

const PluginsListing = () => {
    const navigate = useNavigate();
    const importInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);

    const selectedTeam = useSelectedTeam()!;
    const canCreate = usePermission(['plugin:create']);
    const canUpdate = usePermission(['plugin:update']);

    const { clonePluginUseCase, pluginRepository } = usePluginUseCases();
    const deletePlugin = useDeletePlugin();
    const exportPlugin = useExportPlugin();
    const importPlugin = useImportPlugin();

    const fetchData = useCallback(async (params: GetPluginsInputDTO) => {
        return await pluginRepository.getAll(params);
    }, [pluginRepository]);

    const handleClone = useCallback(async (item: Plugin) => {
        const clonedPlugin = await showPromise(
            clonePluginUseCase.execute({
                pluginId: item._id,
                teamId: selectedTeam._id
            }),
            {
                loading: { title: 'Cloning plugin...' },
                success: { title: 'Plugin cloned' },
                error: { title: 'Failed to clone plugin' }
            }
        );
        navigate(`/plugins/builder?id=${clonedPlugin._id}`);
    }, [clonePluginUseCase, selectedTeam._id, navigate]);

    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        setIsImporting(true);
        try{
            await showPromise(importPlugin(file), {
                loading: { title: 'Importing plugin...' },
                success: { title: 'Plugin imported' },
                error: { title: 'Failed to import plugin' }
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
        await showPromise(
            pluginRepository.update({ id: plugin._id, status: newStatus }),
            {
                loading: { title: `${statusLabels[newStatus]}...` },
                success: { title: successLabels[newStatus] },
                error: { title: 'Failed to update plugin status' }
            }
        );
    }, [pluginRepository]);

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
                handler: ({ item }) => handleClone(item),
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
                    await showPromise(deletePlugin(item._id), {
                        loading: { title: 'Deleting plugin...' },
                        success: { title: 'Plugin deleted' },
                        error: { title: 'Failed to delete plugin' }
                    });
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Delete plugin "${selectedItems[0].modifier?.name || selectedItems[0]._id}"? This action cannot be undone.`
                        : `Delete ${selectedItems.length} plugins? This action cannot be undone.`
                ),
                requiredPermission: 'plugin:delete'
            }
        }
    });

    const getMenuOptions = useCallback((item: Plugin, selectedItems: Plugin[]): MenuOption[] => {
        const baseOptions = getBaseMenuOptions(item, selectedItems);
        if(selectedItems.length > 1 || !canUpdate){
            return baseOptions;
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

        const deleteOption = baseOptions.filter((option) => option.destructive);
        const nonDeleteOptions = baseOptions.filter((option) => !option.destructive);
        return [...nonDeleteOptions, ...statusActions, ...deleteOption];
    }, [getBaseMenuOptions, canUpdate, handleStatusChange]);

    const columns: ColumnConfig[] = useMemo(() => [
        {
            key: 'modifier.name',
            title: 'Name',
            sortable: true,
            render: (_, row) => {
                const plugin = row as Plugin;
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
            render: (_, row) => (row as Plugin).modifier!.version,
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'status',
            title: 'Status',
            sortable: true,
            render: (value) => <StatusBadge status={String(value)} />,
            skeleton: { variant: 'rounded', width: 80, height: 24 }
        },
        {
            key: 'validated',
            title: 'Validated',
            sortable: true,
            render: (value) => (
                <span className={`validation-badge ${value ? 'validated' : 'not-validated'} font-size-1 font-weight-5`}>
                    {value ? 'Yes' : 'No'}
                </span>
            ),
            skeleton: { variant: 'text', width: 50 }
        },
        {
            key: 'exposures',
            title: 'Exposures',
            render: (_, row) => (
                <span className='exposure-count font-size-1 font-weight-6'>
                    {(row as Plugin).exposures!.length}
                </span>
            ),
            skeleton: { variant: 'text', width: 60 }
        },
        dateColumn('createdAt', 'Created', { width: 100 })
    ], [navigate]);

    return (
        <DocumentListing<Plugin>
            title='Plugins'
            columns={columns}
            fetchData={fetchData}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No plugins found. Create your first plugin!'
            createNew={canCreate ? {
                buttonTitle: 'New plugin',
                onCreate: () => navigate('/plugins/builder')
            } : undefined}
            headerActions={canCreate ? (
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
                        onClick={() => importInputRef.current!.click()}
                        disabled={isImporting}
                        isLoading={isImporting}
                        leftIcon={<RiUploadLine size={18} />}
                    >
                        Import
                    </Button>
                </>
            ) : undefined}
            listSyncConfig={LIST_SYNC}
        />
    );
};

export default PluginsListing;
