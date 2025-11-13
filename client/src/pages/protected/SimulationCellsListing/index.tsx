import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiEyeLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig, MethodBadge } from '@/components/organisms/DocumentListing';
import useTeamStore from '@/stores/team/team';
import { api } from '@/api';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import useDashboardSearchStore from '@/stores/ui/dashboard-search'

const SimulationCellsListing = () => {
  const team = useTeamStore((s) => s.selectedTeam);
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(100);

  const searchQuery = useDashboardSearchStore((s) => s.query);

  useEffect(() => {
    if(!team?._id) return;
    const controller = new AbortController();
    setIsLoading(true);
    (async () => {
      try{
        const res = await api.get<{ status: string; data: { cells: any[]; total: number; page: number; limit: number } }>(`/simulation-cell`, {
          params: { teamId: team._id, page: 1, limit, q: searchQuery },
          signal: controller.signal
        });
        setRows(res.data?.data?.cells ?? []);
        setTotal(res.data?.data?.total ?? 0);
        setPage(1);
      }catch(_e){} finally{ setIsLoading(false); }
    })();
    return () => controller.abort();
  }, [team?._id, searchQuery]);

  const handleMenuAction = useCallback(async (action: string, _item: any) => {
    if(action === 'view'){}
  }, []);

  const getMenuOptions = useCallback((item: any) => [
    ['View', RiEyeLine, () => handleMenuAction('view', item)]
  ], [handleMenuAction]);

  const columns: ColumnConfig[] = useMemo(() => ([
    {
      title: 'Trajectory',
      key: 'trajectory',
      sortable: true,
      render: (v) => (typeof v === 'object' ? v?.name ?? '—' : String(v)),
      skeleton: { variant: 'text', width: 160 }
    },
    {
      title: 'Method',
      key: 'analysisConfig',
      render: (v) => <MethodBadge method={v?.identificationMode ?? '—'} />,
      skeleton: { variant: 'rounded', width: 80, height: 24 }
    },
    {
      title: 'Timestep',
      key: 'timestep',
      sortable: true,
      skeleton: { variant: 'text', width: 70 }
    },
    {
      title: 'Volume',
      key: 'volume',
      sortable: true,
      skeleton: { variant: 'text', width: 80 }
    },
    {
      title: 'Angles (α/β/γ)',
      key: 'angles',
      render: (v) => v ? `${v.alpha.toFixed(2)} / ${v.beta.toFixed(2)} / ${v.gamma.toFixed(2)}` : '—',
      skeleton: { variant: 'text', width: 120 }
    },
    {
      title: 'PBC (x/y/z)',
      key: 'periodicBoundaryConditions',
      render: (v) => v ? `${v.x ? 'T' : 'F'} / ${v.y ? 'T' : 'F'} / ${v.z ? 'T' : 'F'}` : '—',
      skeleton: { variant: 'text', width: 90 }
    },
    {
      title: 'Dimensionality',
      key: 'dimensionality',
      render: (v) => v ? (v.is_2d ? '2D' : `${v.effective_dimensions}D`) : '—',
      skeleton: { variant: 'text', width: 80 }
    },
    {
      title: 'Created At',
      key: 'createdAt',
      sortable: true,
      render: (v) => formatTimeAgo(v),
      skeleton: { variant: 'text', width: 90 }
    }
  ]), []);

  return (
    <DocumentListing
      title='Simulation Cells'
      breadcrumbs={['Dashboard', 'Simulation Cells']}
      columns={columns}
      data={rows}
      isLoading={isLoading}
      onMenuAction={handleMenuAction}
      getMenuOptions={getMenuOptions}
      emptyMessage='No simulation cells found'
      enableInfinite
      hasMore={rows.length < total}
      isFetchingMore={isLoading && rows.length > 0}
      onLoadMore={useCallback(async () => {
        if(!team?._id) return;
        if(rows.length >= total) return;
        const next = page + 1;
        setIsLoading(true);
        try{
          const res = await api.get<{ status: string; data: { cells: any[]; total: number; page: number; limit: number } }>(`/simulation-cell`, {
            params: { teamId: team._id, page: next, limit, q: searchQuery }
          });
          setRows((prev) => [...prev, ...(res.data?.data?.cells ?? [])]);
          setTotal(res.data?.data?.total ?? total);
          setPage(next);
        }catch(_e){} finally{ setIsLoading(false); }
      }, [team?._id, rows.length, total, page, limit, searchQuery])}
    />
  );
};

export default SimulationCellsListing;
