import { useCallback, useEffect, useMemo, useState } from 'react'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing'
import useTeamStore from '@/stores/team/team'
import analysisConfigApi from '@/services/api/analysis-config'
import formatTimeAgo from '@/utilities/formatTimeAgo'
import useDashboardSearchStore from '@/stores/ui/dashboard-search'

const AnalysisConfigsListing = () => {
  const team = useTeamStore((state) => state.selectedTeam)
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [total, setTotal] = useState<number>(0)
  const [limit] = useState<number>(20)

  const searchQuery = useDashboardSearchStore((s) => s.query);

  useEffect(() => {
    if (!team?._id) return
    const controller = new AbortController()
    setIsLoading(true)
      ; (async () => {
        try {
          const res = await analysisConfigApi.getByTeamId(team._id, { page: 1, limit, q: searchQuery }) as any;
          setData(res?.configs ?? [])
          setTotal(res?.total ?? 0)
          setPage(1)
        } catch (e) {/* noop */ }
        finally { setIsLoading(false) }
      })()
    return () => controller.abort()
  }, [team?._id, limit, searchQuery])

  const handleMenuAction = useCallback(async (action: string, item: any) => {
    switch (action) {
      case 'view':
        break
      case 'delete':
        // Confirm, then optimistic delete with rollback
        if (!window.confirm('Delete this analysis config? This cannot be undone.')) return
        setData((prev) => prev.filter((x) => x._id !== item._id))
        try {
          await analysisConfigApi.delete(item._id)
        } catch (e) {
          setData((prev) => {
            const exists = prev.find((x) => x._id === item._id)
            return exists ? prev : [item, ...prev]
          })
        }
        break
    }
  }, [])

  const getMenuOptions = useCallback((item: any) => ([
    ['View', RiEyeLine, () => handleMenuAction('view', item)],
    ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
  ]), [handleMenuAction])

  // Columns: only the requested fields
  const columns: ColumnConfig[] = useMemo(() => [
    {
      title: 'Trajectory',
      sortable: true,
      key: 'trajectory.name',
      render: (_value, row) => row?.trajectory?.name ?? '-',
      skeleton: { variant: 'text', width: 140 }
    },
    {
      title: 'Plugin',
      sortable: true,
      key: 'plugin',
      render: (value) => (value ? String(value) : '-'),
      skeleton: { variant: 'text', width: 110 }
    },
    {
      title: 'Modifier',
      sortable: true,
      key: 'modifier',
      render: (value) => (value ? String(value) : '-'),
      skeleton: { variant: 'text', width: 130 }
    },
    {
      title: 'Total Frames',
      sortable: true,
      key: 'totalFrames',
      render: (value) => (typeof value === 'number' ? value.toLocaleString() : '-'),
      skeleton: { variant: 'text', width: 90 }
    },
    {
      title: 'Completed Frames',
      sortable: true,
      key: 'completedFrames',
      render: (value) => (typeof value === 'number' ? value.toLocaleString() : '-'),
      skeleton: { variant: 'text', width: 110 }
    },
    {
      title: 'Created',
      sortable: true,
      key: 'createdAt',
      render: (value) => formatTimeAgo(value),
      skeleton: { variant: 'text', width: 100 }
    }
  ], [])

  return (
    <DocumentListing
      title='Analysis Configs'
      breadcrumbs={['Dashboard', 'Analysis Configs']}
      columns={columns}
      data={data}
      isLoading={isLoading}
      onMenuAction={handleMenuAction}
      getMenuOptions={getMenuOptions}
      emptyMessage='No analysis configs found'
      enableInfinite
      hasMore={data.length < total}
      isFetchingMore={isLoading && data.length > 0}
      onLoadMore={useCallback(async () => {
        if (!team?._id) return
        if (data.length >= total) return
        const next = page + 1
        setIsLoading(true)
        try {
          const res = await analysisConfigApi.getByTeamId(team._id, { page: next, limit, q: searchQuery }) as any;
          const nextRows = res?.configs ?? []
          setData((prev) => [...prev, ...nextRows])
          setTotal(res?.total ?? total)
          setPage(next)
        } catch (_e) {/* noop */ }
        finally { setIsLoading(false) }
      }, [team?._id, data.length, total, page, limit, searchQuery])}
    />
  )
}

export default AnalysisConfigsListing
