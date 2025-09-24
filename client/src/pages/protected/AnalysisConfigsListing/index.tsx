import { useEffect, useState } from 'react'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig } from '@/components/organisms/DocumentListing'
import useTeamStore from '@/stores/team/team'
import { api } from '@/services/api'
import formatTimeAgo from '@/utilities/formatTimeAgo'

const AnalysisConfigsListing = () => {
  const team = useTeamStore((state) => state.selectedTeam)
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [total, setTotal] = useState<number>(0)
  const [limit] = useState<number>(20)

  useEffect(() => {
    if(!team?._id) return
    const controller = new AbortController()
    setIsLoading(true)
    ;(async () => {
      try{
        const res = await api.get<{ status: string; data: { configs: any[]; total: number; page: number; limit: number } }>(
          `/analysis-config/team/${team._id}`,
          { params: { page: 1, limit }, signal: controller.signal }
        )
        setData(res.data?.data?.configs ?? [])
        setTotal(res.data?.data?.total ?? 0)
        setPage(1)
      }catch(e){/* noop */}
      finally{ setIsLoading(false) }
    })()
    return () => controller.abort()
  }, [team?._id, limit])

  const handleMenuAction = async (action: string, item: any) => {
    switch(action){
      case 'view':
        break
      case 'delete':
        // Confirm, then optimistic delete with rollback
        if(!window.confirm('Delete this analysis config? This cannot be undone.')) return
        setData((prev) => prev.filter((x) => x._id !== item._id))
        try{
          await api.delete(`/analysis-config/${item._id}`)
        }catch(e){
          setData((prev) => {
            const exists = prev.find((x) => x._id === item._id)
            return exists ? prev : [item, ...prev]
          })
        }
        break
    }
  }

  const getMenuOptions = (item: any) => [
    ['View', RiEyeLine, () => handleMenuAction('view', item)],
    ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
  ]

  // Columns: only the requested fields
  const columns: ColumnConfig[] = [
    {
      title: 'Trajectory',
      sortable: true,
      key: 'trajectory',
      render: (v) => (typeof v === 'object' ? v?.name ?? '\u2014' : String(v)),
      skeleton: { variant: 'text', width: 120 }
    },
    {
      title: 'Crystal Structure',
      sortable: true,
      key: 'crystalStructure',
      skeleton: { variant: 'rounded', width: 110, height: 24 }
    },
    {
      title: 'Identification Mode',
      sortable: true,
      key: 'identificationMode',
      skeleton: { variant: 'rounded', width: 110, height: 24 }
    },
    {
      title: 'RMSD',
      sortable: true,
      key: 'RMSD',
      render: (v) => (typeof v === 'number' ? v.toFixed(3) : String(v ?? '\u2014')),
      skeleton: { variant: 'text', width: 60 }
    },
    {
      title: 'Max Trial Circuit',
      sortable: true,
      key: 'maxTrialCircuitSize',
      skeleton: { variant: 'text', width: 60 }
    },
    {
      title: 'Circuit Stretchability',
      sortable: true,
      key: 'circuitStretchability',
      skeleton: { variant: 'text', width: 80 }
    },
    {
      title: 'Dislocations',
      sortable: true,
      key: 'dislocationsCount',
      skeleton: { variant: 'text', width: 40 }
    },
    {
      title: 'Created',
      sortable: true,
      key: 'createdAt',
      render: (v) => formatTimeAgo(v),
      skeleton: { variant: 'text', width: 90 }
    }
  ]

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
      onLoadMore={async () => {
        if(!team?._id) return
        if(data.length >= total) return
        const next = page + 1
        setIsLoading(true)
        try{
          const res = await api.get<{ status: string; data: { configs: any[]; total: number; page: number; limit: number } }>(
            `/analysis-config/team/${team._id}`,
            { params: { page: next, limit } }
          )
          const nextRows = res.data?.data?.configs ?? []
          setData((prev) => [...prev, ...nextRows])
          setTotal(res.data?.data?.total ?? total)
          setPage(next)
        }catch(_e){/* noop */}
        finally{ setIsLoading(false) }
      }}
    />
  )
}

export default AnalysisConfigsListing
