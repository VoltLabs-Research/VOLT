import { useEffect, useMemo, useRef, useState } from 'react';
import DocumentListingTable from '@/components/molecules/DocumentListingTable';
import type { ColumnConfig } from '@/components/organisms/DocumentListing';
import useFrameAtoms from '@/hooks/trajectory/use-frame-atoms';
import './FrameAtomsTable.css';

export type FrameAtomsTableProps = {
  trajectoryId: string;
  timestep: number;
  pageSize?: number;
  initialPage?: number;
  decimals?: number;
};

const FrameAtomsTable = ({
  trajectoryId,
  timestep,
  pageSize = 1000,
  initialPage = 1,
  decimals = 3,
}: FrameAtomsTableProps) => {
  const [page, setPage] = useState<number>(initialPage);
  const [accRows, setAccRows] = useState<Array<{ idx: number; type?: number; x: number; y: number; z: number }>>([]);
  const [lastAppendedPage, setLastAppendedPage] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset when inputs change
  useEffect(() => {
    setPage(initialPage);
    setAccRows([]);
    setLastAppendedPage(0);
  }, [trajectoryId, timestep, pageSize, initialPage]);

  const { data, loading } = useFrameAtoms(trajectoryId, timestep, { page, pageSize });

  // Deterministic color per particle type (1-based). Falls back to HSL if palette overflows.
  const typePalette = useMemo(
    () => [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
      '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
    ],
    []
  );

  const typeToColor = (t?: number): string => {
    if (!Number.isFinite(t)) return '#888';
    const type = Math.max(1, Math.floor(t as number));
    if (type <= typePalette.length) return typePalette[type - 1];
    // HSL fallback for many types
    const hue = ((type - 1) * 47) % 360; // pseudo-random but stable
    return `hsl(${hue}deg 60% 55%)`;
  };

  const columns: ColumnConfig[] = useMemo(() => [
    { key: 'idx', title: 'Particle', skeleton: { variant: 'text', width: 60 } },
    {
      key: 'type',
      title: 'Type',
      skeleton: { variant: 'text', width: 60 },
      render: (v: number) => (
        <span className='type-cell'>
          <span className='type-color-swatch' style={{ backgroundColor: typeToColor(v) }} />
          {v ?? ''}
        </span>
      )
    },
    { key: 'x', title: 'X', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(decimals) ?? String(v) },
    { key: 'y', title: 'Y', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(decimals) ?? String(v) },
    { key: 'z', title: 'Z', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(decimals) ?? String(v) },
  ], [decimals, typePalette]);

  // Build and accumulate rows as new pages load
  useEffect(() => {
    if (!data?.positions) return;
    const currPage = data.page ?? page;
    const currPageSize = data.pageSize ?? pageSize;
    const startIndex = (currPage - 1) * currPageSize;
    const types = data.types ?? [];
    const newRows = data.positions.map((pos: number[], i: number) => ({
      idx: startIndex + i + 1,
      type: Number.isFinite(types[i]) ? types[i] : undefined,
      x: pos[0],
      y: pos[1],
      z: pos[2],
    }));

    // First page or reset
    if (currPage <= 1 || lastAppendedPage === 0) {
      setAccRows(newRows);
      setLastAppendedPage(currPage);
      return;
    }

    // Append only if this is the next page
    if (currPage > lastAppendedPage) {
      setAccRows(prev => [...prev, ...newRows]);
      setLastAppendedPage(currPage);
    }
  }, [data, page, pageSize, lastAppendedPage]);

  const rows = accRows;

  // Determine if there are more pages to load
  const total = data?.total ?? data?.natoms;
  const effectivePageSize = data?.pageSize ?? pageSize;
  const hasMore = typeof total === 'number'
    ? rows.length < total
    : (data?.positions?.length ?? 0) === effectivePageSize;

  // Infinite scroll: observe sentinel visibility within the scroll container
  useEffect(() => {
    const container = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!container || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { root: container, rootMargin: '0px 0px 200px 0px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  // pagination metadata available in `data` if needed later
  // calculated values kept minimal; pagination UI can be added if needed

  const isInitialLoading = loading && rows.length === 0;

  return (
    <div className='frame-atoms-table-container primary-surface' ref={containerRef}>
      <DocumentListingTable 
        columns={columns} 
        data={rows} 
        isLoading={isInitialLoading} />
      {/* Loading more indicator and intersection sentinel */}
      <div style={{ padding: '0.5rem 1rem', opacity: 0.8 }}>
        {!isInitialLoading && loading ? 'Loading more...' : ''}
      </div>
      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  );
};

export default FrameAtomsTable;
