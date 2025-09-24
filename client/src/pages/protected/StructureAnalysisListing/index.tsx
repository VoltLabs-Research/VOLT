import { useCallback, useEffect, useMemo, useState } from 'react'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig, MethodBadge, RateBadge, formatNumber } from '@/components/organisms/DocumentListing'
import useTeamStore from '@/stores/team/team'
import formatTimeAgo from '@/utilities/formatTimeAgo'
import { api } from '@/services/api'
import useDashboardSearchStore from '@/stores/ui/dashboard-search'

const StructureAnalysisListing = () => {
    const team = useTeamStore((state) => state.selectedTeam)
    const [data, setData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [page, setPage] = useState<number>(1)
    const [total, setTotal] = useState<number>(0)
    const [limit] = useState<number>(100)

    const searchQuery = useDashboardSearchStore((s) => s.query)

    useEffect(() => {
        if (!team?._id) return
        let canceled = false
        setIsLoading(true)
        ;(async () => {
            try {
                const res = await api.get(`/structure-analysis/team/${team._id}`, {
                    params: { page: 1, limit, sort: '-createdAt', q: searchQuery }
                })
                if (canceled) return
                const payload: any = (res as any)?.data?.data || {}
                const map = payload?.analysesByTrajectory || {}
                const flat = Object.values(map).flat()
                setData(flat)
                setTotal(Number(payload?.totalAnalyses ?? flat.length) || 0)
                setPage(1)
            } catch (_e) {
                if (!canceled) {
                    setData([])
                    setTotal(0)
                }
            } finally {
                if (!canceled) setIsLoading(false)
            }
        })()
        return () => {
            canceled = true
        }
    }, [team, limit, searchQuery])

    const handleMenuAction = useCallback((action: string, _item: any) => {
        switch (action) {
            case 'view':
                break
            case 'delete':
                break
        }
    }, [])

    const getMenuOptions = useCallback((item: any) => ([
        ['View', RiEyeLine, () => handleMenuAction('view', item)],
        ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
    ]), [handleMenuAction])

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Trajectory',
            sortable: true,
            key: 'trajectory',
            render: (v) => (typeof v === 'object' ? v?.name ?? '—' : String(v)),
            skeleton: { variant: 'text', width: 120 }
        },
        {
            title: 'Method',
            sortable: true,
            key: 'analysisMethod',
            render: (v) => <MethodBadge method={v} />,
            skeleton: { variant: 'rounded', width: 80, height: 24 }
        },
        {
            title: 'Identification Rate',
            sortable: true,
            key: 'identificationRate',
            render: (v) => <RateBadge rate={Number(v)} />,
            skeleton: { variant: 'rounded', width: 60, height: 24 }
        },
        {
            title: 'Total Identified',
            sortable: true,
            key: 'identifiedStructures',
            render: (v) => formatNumber(Number(v)),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Total Unidentified',
            sortable: true,
            key: 'unidentifiedStructures',
            render: (v) => formatNumber(Number(v)),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Total Atoms',
            sortable: true,
            key: 'totalAtoms',
            render: (v) => formatNumber(Number(v)),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Timestep',
            sortable: true,
            key: 'timestep',
            render: (v) => Number(v),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Creation Date',
            sortable: true,
            key: 'createdAt',
            render: (v) => formatTimeAgo(v),
            skeleton: { variant: 'text', width: 90 }
        }
    ], [])

    return (
        <DocumentListing
            title='Structure Analysis'
            breadcrumbs={['Dashboard', 'Structure Analysis']}
            columns={columns}
            data={data}
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            emptyMessage='No structure analyses found'
            enableInfinite
            hasMore={data.length < total}
            isFetchingMore={isLoading && data.length > 0}
            onLoadMore={useCallback(async () => {
                if (!team?._id) return
                if (data.length >= total) return
                const next = page + 1
                setIsLoading(true)
                try {
                    const res = await api.get(`/structure-analysis/team/${team._id}`, {
                        params: { page: next, limit, sort: '-createdAt', q: searchQuery }
                    })
                    const payload: any = (res as any)?.data?.data || {}
                    const map = payload?.analysesByTrajectory || {}
                    const flat = Object.values(map).flat()
                    setData((prev) => [...prev, ...flat])
                    setPage(next)
                    setTotal(Number(payload?.totalAnalyses ?? total) || total)
                } catch (_e) {
                    /* noop */
                } finally {
                    setIsLoading(false)
                }
            }, [team?._id, data.length, total, page, limit, searchQuery])}
        />
    )
}

export default StructureAnalysisListing
