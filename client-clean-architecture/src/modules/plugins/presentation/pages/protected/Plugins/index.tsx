import { useCallback, useMemo, useState, useRef } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEditLine, RiFileCopyLine, RiDownloadLine, RiUploadLine } from 'react-icons/ri';
import { TbRocket } from 'react-icons/tb';
import DocumentListing, { type ColumnConfig, StatusBadge } from '@/shared/presentation/components/organisms/common/DocumentListing';
import { usePlugins, useDeletePlugin, usePublishPlugin } from '@/modules/plugins/presentation/hooks/use-plugin-queries';
import { PluginStatus } from '@/types/plugin';
import { formatDistanceToNow } from 'date-fns';
import { useTeamStore } from '@/modules/team/presentation/stores';
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import type { IPluginRecord } from '@/modules/plugins/domain/types';
import { pluginRepository } from '@/modules/plugins/infrastructure/repositories/PluginRepository';
import '@/modules/plugins/presentation/pages/protected/Plugins/Plugins.css';

const PluginsListing = () => {
    usePageTitle('Plugins');
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    
    const {
        plugins,
        listingMeta,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage
    } = usePlugins({ search });

    const deletePlugin = useDeletePlugin();
    const publishPlugin = usePublishPlugin();

    const selectedTeam = useTeamStore((s) => s.selectedTeam);
    const { showSuccess } = useToast();
    const [isImporting, setIsImporting] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const { confirm } = useConfirm();

    const lifecycleProps = {
        listingMeta,
        onLoadMore: fetchNextPage,
        hasMore: hasNextPage,
        isFetchingMore: isFetchingNextPage
    };

    const handleMenuAction = useCallback(async (action: string, item: IPluginRecord) => {
        switch (action) {
            case 'edit':
                navigate(`/dashboard/plugins/builder?id=${item._id}`);
                break;
            case 'clone':
                try {
                    const originalPlugin = await pluginRepository.getPlugin(item._id);
                    const clonedNodes = originalPlugin.workflow.nodes.map((node: any) => {
                        if (node.type === 'modifier' && node.data.modifier) {
                            return {
                                ...node,
                                data: {
                                    ...node.data,
                                    modifier: {
                                        ...node.data.modifier,
                                        name: `${node.data.modifier.name || 'Plugin'} (Copy)`
                                    }
                                }
                            };
                        }
                        return node;
                    });
                    const clonedWorkflow = {
                        ...originalPlugin.workflow,
                        nodes: clonedNodes
                    };
                    const clonedPlugin = await pluginRepository.createPlugin({
                        slug: `${item.slug}-copy-${Date.now()}`,
                        workflow: clonedWorkflow,
                        status: PluginStatus.DRAFT,
                        team: selectedTeam?._id
                    });
                    navigate(`/dashboard/plugins/builder?id=${clonedPlugin._id}`);
                } catch (e) {
                    console.error('Failed to clone plugin:', e);
                }
                break;
            case 'publish':
                try {
                    await publishPlugin.mutateAsync(item._id);
                    showSuccess('Plugin published successfully');
                } catch (e) {
                    console.error('Failed to publish plugin:', e);
                }
                break;
            case 'delete':
                if (!await confirm(`Delete plugin "${item.slug}"? This action cannot be undone.`)) return;
                try {
                    await deletePlugin.mutateAsync(item._id);
                    showSuccess('Plugin deleted successfully');
                } catch (e) {
                    console.error('Failed to delete plugin:', e);
                }
                break;
            case 'export':
                try {
                    const blob = await pluginRepository.exportPlugin(item._id);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${item.slug || 'plugin'}.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.error('Failed to export plugin:', e);
                }
                break;
        }
    }, [navigate, selectedTeam?._id, confirm, publishPlugin, deletePlugin, showSuccess]);

    const getMenuOptions = useCallback((item: IPluginRecord) => {
        const options: Array<[string, React.ElementType, () => void]> = [
            ['Edit', RiEditLine, () => handleMenuAction('edit', item)],
            ['Clone', RiFileCopyLine, () => handleMenuAction('clone', item)],
            ['Export', RiDownloadLine, () => handleMenuAction('export', item)]
        ];

        if (item.status !== 'published') {
            options.push(['Publish', TbRocket, () => handleMenuAction('publish', item)]);
        }

        options.push(['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]);

        return options;
    }, [handleMenuAction]);

    const handleRowClick = useCallback((item: IPluginRecord) => {
        navigate(`/dashboard/plugins/builder?id=${item._id}`);
    }, [navigate]);

    const handleCreateNew = useCallback(() => {
        navigate('/dashboard/plugins/builder');
    }, [navigate]);

    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            await pluginRepository.importPlugin(file, selectedTeam?._id);
            // navigate(`/dashboard/plugins/builder?id=${importedPlugin._id}`);
            showSuccess(`Plugin imported successfully!`);
        } catch (err) {
            console.error('Failed to import plugin:', err);
        } finally {
            setIsImporting(false);
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    }, [selectedTeam?._id, showSuccess]);

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Name',
            sortable: true,
            key: 'modifier.name',
            render: (_value, row) => (
                <span
                    className='plugin-name-link font-size-2 font-weight-5 cursor-pointer'
                    onClick={() => handleRowClick(row)}
                >
                    {row?.modifier?.name ?? row?.slug ?? '—'}
                </span>
            ),
            skeleton: { variant: 'text', width: 160 }
        },
        {
            title: 'Version',
            sortable: true,
            key: 'modifier.version',
            render: (_value, row) => row?.modifier?.version ?? '1.0.0',
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Status',
            sortable: true,
            key: 'status',
            render: (value) => <StatusBadge status={value ?? 'draft'} />,
            skeleton: { variant: 'rounded', width: 80, height: 24 }
        },
        {
            title: 'Validated',
            sortable: true,
            key: 'validated',
            render: (value) => (
                <span className={`d-flex items-center validation-badge ${value ? 'validated' : 'not-validated'} font-size-1 font-weight-5`}>
                    {value ? 'Yes' : 'No'}
                </span>
            ),
            skeleton: { variant: 'text', width: 50 }
        },
        {
            title: 'Exposures',
            sortable: false,
            key: 'exposures',
            render: (_value, row) => {
                const count = row?.exposures?.length ?? 0;
                return <span className='d-flex flex-center exposure-count font-size-1 font-weight-6'>{count}</span>;
            },
            skeleton: { variant: 'text', width: 60 }
        },
        {
            title: 'Created',
            sortable: true,
            key: 'createdAt',
            render: (value) => formatDistanceToNow(value),
            skeleton: { variant: 'text', width: 100 }
        }
    ], [handleRowClick]);

    return (
        <DocumentListing
            title='Plugins'
            columns={columns}
            data={plugins}
            isLoading={isLoading}
            getMenuOptions={getMenuOptions}
            emptyMessage='No plugins found. Create your first plugin!'
            {...lifecycleProps}
            createNew={{
                buttonTitle: 'New plugin',
                onCreate: handleCreateNew
            }}
            headerActions={
                <>
                    <input
                        ref={importInputRef}
                        type='file'
                        accept='.zip'
                        onChange={handleImport}
                        style={{ display: 'none' }}
                    />
                    <button
                        className='import-plugin-btn cursor-pointer'
                        onClick={() => importInputRef.current?.click()}
                        disabled={isImporting}
                        title='Import Plugin'
                    >
                        <RiUploadLine size={18} />
                    </button>
                </>
            }
        />
    );
};

export default PluginsListing;
