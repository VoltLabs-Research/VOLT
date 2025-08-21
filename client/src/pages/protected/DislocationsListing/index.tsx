import React, { useEffect, useMemo, useState } from 'react';
import { RiEyeLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig, formatNumber } from '@/components/organisms/DocumentListing';
import useTeamStore from '@/stores/team';
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
      // TODO: navega al detalle si lo tienes (por ahora sólo log)
      // e.g. router.push(`/dislocations/${item._id}`)
      console.log('view :: dislocation doc', item);
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
        render: (v) => (typeof v === 'object' ? v?.name ?? '—' : String(v)),
        skeleton: { variant: 'text', width: 160 }
      },
      {
        title: 'Timestep',
        key: 'timestep',
        render: (v) => formatNumber(Number(v ?? 0)),
        skeleton: { variant: 'text', width: 70 }
      },
      {
        title: 'Segments',
        key: 'totalSegments',
        render: (v) => formatNumber(Number(v ?? 0)),
        skeleton: { variant: 'text', width: 70 }
      },
      {
        title: 'Avg Seg. Length',
        key: 'averageSegmentLength',
        render: (v) => formatFloat(Number(v ?? 0), 3),
        skeleton: { variant: 'text', width: 80 }
      },
      {
        title: 'Total Length',
        key: 'totalLength',
        render: (v) => formatFloat(Number(v ?? 0), 3),
        skeleton: { variant: 'text', width: 80 }
      },
      {
        title: 'Points',
        key: 'totalPoints',
        render: (v) => formatNumber(Number(v ?? 0)),
        skeleton: { variant: 'text', width: 70 }
      },
      {
        title: 'Created At',
        key: 'createdAt',
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
