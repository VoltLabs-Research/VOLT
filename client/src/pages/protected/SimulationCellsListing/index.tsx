import { useEffect, useMemo, useState } from 'react';
import { RiEyeLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig, MethodBadge } from '@/components/organisms/DocumentListing';
import useTeamStore from '@/stores/team/team';
import { api } from '@/services/api';
import formatTimeAgo from '@/utilities/formatTimeAgo';

const SimulationCellsListing = () => {
  const team = useTeamStore((s) => s.selectedTeam);
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if(!team?._id) return;
    const controller = new AbortController();
    setIsLoading(true);
    (async () => {
      try{
        const res = await api.get<{ status: string; data: { cells: any[] } }>(`/simulation-cell`, {
          params: { teamId: team._id, limit: 200 },
          signal: controller.signal
        });
        setRows(res.data?.data?.cells ?? []);
      }catch(_e){} finally{ setIsLoading(false); }
    })();
    return () => controller.abort();
  }, [team?._id]);

  const handleMenuAction = async (action: string, _item: any) => {
    if(action === 'view'){}
  };

  const getMenuOptions = (item: any) => [
    ['View', RiEyeLine, () => handleMenuAction('view', item)]
  ];

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
    />
  );
};

export default SimulationCellsListing;
