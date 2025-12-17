import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEditLine, RiAddLine } from 'react-icons/ri';
import { TbRocket } from 'react-icons/tb';
import DocumentListing, { type ColumnConfig, StatusBadge } from '@/components/organisms/common/DocumentListing';
import Button from '@/components/primitives/Button';
import pluginApi, { type IPluginRecord } from '@/services/api/plugin';
import { PluginStatus } from '@/types/plugin';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import useDashboardSearchStore from '@/stores/ui/dashboard-search';
import './Plugins.css';

const PluginsListing = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<IPluginRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [page, setPage] = useState<number>(1);
    const [total, setTotal] = useState<number>(0);
    const [limit] = useState<number>(20);

    const searchQuery = useDashboardSearchStore((s) => s.query);

    const fetchPlugins = useCallback(async (pageNum: number, append: boolean = false) => {
        setIsLoading(true);
        try {
            const res = await pluginApi.getPlugins({ page: pageNum, limit, search: searchQuery });
            const plugins = res.data ?? [];
            const totalCount = res.results?.total ?? plugins.length;

            setData((prev) => (append ? [...prev, ...plugins] : plugins));
            setTotal(totalCount);
            setPage(pageNum);
        } catch (e) {
            console.error('Failed to fetch plugins:', e);
        } finally {
            setIsLoading(false);
        }
    }, [limit, searchQuery]);

    useEffect(() => {
        fetchPlugins(1, false);
    }, [fetchPlugins]);

    const handleMenuAction = useCallback(async (action: string, item: IPluginRecord) => {
        switch (action) {
            case 'edit':
                navigate(`/dashboard/plugins/builder?id=${item._id}`);
                break;
            case 'publish':
                try {
                    await pluginApi.publishPlugin(item._id);
                    setData((prev) =>
                        prev.map((p) =>
                            p._id === item._id ? { ...p, status: PluginStatus.PUBLISHED } : p
                        )
                    );
                } catch (e) {
                    console.error('Failed to publish plugin:', e);
                }
                break;
            case 'delete':
                if (!window.confirm('Delete this plugin? This cannot be undone.')) return;
                setData((prev) => prev.filter((x) => x._id !== item._id));
                try {
                    await pluginApi.deletePlugin(item._id);
                } catch (e) {
                    setData((prev) => {
                        const exists = prev.find((x) => x._id === item._id);
                        return exists ? prev : [item, ...prev];
                    });
                }
                break;
        }
    }, [navigate]);

    const getMenuOptions = useCallback((item: IPluginRecord) => {
        const options: Array<[string, React.ElementType, () => void]> = [
            ['Edit', RiEditLine, () => handleMenuAction('edit', item)]
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

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Name',
            sortable: true,
            key: 'modifier.name',
            render: (_value, row) => (
                <span
                    className='plugin-name-link font-weight-5 cursor-pointer'
                    onClick={() => handleRowClick(row)}
                >
                    {row?.modifier?.name ?? row?.slug ?? '—'}
                </span>
            ),
            skeleton: { variant: 'text', width: 160 }
        },
        {
            title: 'Slug',
            sortable: true,
            key: 'slug',
            render: (value) => <code className='plugin-slug'>{value ?? '—'}</code>,
            skeleton: { variant: 'text', width: 120 }
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
            title: 'Author',
            sortable: true,
            key: 'modifier.author',
            render: (_value, row) => row?.modifier?.author ?? '—',
            skeleton: { variant: 'text', width: 100 }
        },
        {
            title: 'Created',
            sortable: true,
            key: 'createdAt',
            render: (value) => formatTimeAgo(value),
            skeleton: { variant: 'text', width: 100 }
        }
    ], [handleRowClick]);

    const breadcrumbsWithAction = useMemo(() => [
        'Dashboard',
        'Plugins',
        <Button
            key='create-btn'
            variant='solid'
            intent='brand'
            size='sm'
            leftIcon={<RiAddLine size={16} />}
            onClick={handleCreateNew}
        >
            New Plugin
        </Button>
    ], [handleCreateNew]);

    return (
        <DocumentListing
            title='Plugins'
            breadcrumbs={breadcrumbsWithAction}
            columns={columns}
            data={data}
            isLoading={isLoading}
            getMenuOptions={getMenuOptions}
            emptyMessage='No plugins found. Create your first plugin!'
            enableInfinite
            hasMore={data.length < total}
            isFetchingMore={isLoading && page > 1}
            onLoadMore={() => fetchPlugins(page + 1, true)}
        />
    );
};

export default PluginsListing;
