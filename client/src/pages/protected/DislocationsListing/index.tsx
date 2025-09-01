import React, { useEffect, useMemo, useState } from 'react';
import { RiEyeLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig, formatNumber, MethodBadge } from '@/components/organisms/DocumentListing';
import useTeamStore from '@/stores/team/team';
import useDislocationStore from '@/stores/dislocations';
import formatTimeAgo from '@/utilities/formatTimeAgo';

const formatFloat = (v: number, digits = 2) =>
  typeof v === 'number' ? Number(v).toFixed(digits).replace(/\.?0+$/, '') : '—';

const DislocationsListing = () => {
  const team = useTeamStore((s) => s.selectedTeam);

  const getUserDislocations = useDislocationStore((s) => s.getUserDislocations);
  const isLoading = useDislocationStore((s) => s.isLoading);
  const rows = useDislocationStore((s) => s.dislocations);
  const totals = useDislocationStore((s) => s.totals);

  const [data, setData] = useState<any[]>([]);

  // Cargar al cambiar el equipo
  useEffect(() => {
    if (!team?._id) return;
    getUserDislocations({ teamId: team._id, page: 1 });
  }, [team]);

  // Reflejar cambios del store en la tabla
  useEffect(() => {
    if (!isLoading) setData(rows || []);
  }, [isLoading, rows]);

  const handleMenuAction = async (action: string, item: any) => {
    if (action === 'view') {
    }
  };

  const getMenuOptions = (item: any) => [
    ['View', RiEyeLine, () => handleMenuAction('view', item)]
    // Ignoramos delete por ahora
  ];

  const columns: ColumnConfig[] = useMemo(
    () => [
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
          render: (v) => <MethodBadge method={v.identificationMode} />,
          skeleton: { variant: 'rounded', width: 80, height: 24 }
      },
      {
        title: 'Timestep',
        key: 'timestep',
        sortable: true,
        render: (v) => Number(v ?? 0),
        skeleton: { variant: 'text', width: 70 }
      },
      {
        title: 'RMSD',
        sortable: true,
        key: 'analysisConfig',
        render: (v) => v.identificationMode === 'CNA' ? 'N/A' : v.RMSD,
        skeleton: { variant: 'text', width: 70 }
      },
      {
        title: 'Segments',
        key: 'totalSegments',
        sortable: true,
        render: (v) => formatNumber(Number(v ?? 0)),
        skeleton: { variant: 'text', width: 70 }
      },
      {
        title: 'Avg Seg. Length',
        key: 'averageSegmentLength',
        sortable: true,
        render: (v) => formatFloat(Number(v ?? 0), 3),
        skeleton: { variant: 'text', width: 80 }
      },
      {
        title: 'Total Length',
        key: 'totalLength',
        sortable: true,
        render: (v) => formatFloat(Number(v ?? 0), 3),
        skeleton: { variant: 'text', width: 80 }
      },
      {
        title: 'Points',
        key: 'totalPoints',
        sortable: true,
        render: (v) => formatNumber(Number(v ?? 0)),
        skeleton: { variant: 'text', width: 70 }
      },
      {
        title: 'Created At',
        key: 'createdAt',
        sortable: true,
        render: (v) => formatTimeAgo(v),
        skeleton: { variant: 'text', width: 90 }
      }
    ],
    []
  );

  return (
    <DocumentListing
      title={`Dislocations${totals?.segments ? ` · ${formatNumber(totals.segments)} segments` : ''}`}
      breadcrumbs={['Dashboard', 'Dislocations']}
      columns={columns}
      data={data}
      isLoading={isLoading}
      onMenuAction={handleMenuAction}
      getMenuOptions={getMenuOptions}
      showSearch
      emptyMessage='No dislocations found'
    />
  );
};

export default DislocationsListing;
