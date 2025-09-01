import { useEffect, useState } from 'react'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig, MethodBadge, RateBadge, formatNumber } from '@/components/organisms/DocumentListing'
import useTrajectoryStore from '@/stores/trajectories'
import useTeamStore from '@/stores/team/team'
import formatTimeAgo from '@/utilities/formatTimeAgo'

const StructureAnalysisListing = () => {
    const getStructuresAnalysis = useTrajectoryStore((state) => state.getStructureAnalysis)
    const team = useTeamStore((state) => state.selectedTeam)
    const isLoading = useTrajectoryStore((state) => state.isLoading)
    const structureAnalysis = useTrajectoryStore((state) => state.structureAnalysis)
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        if (!team?._id) return
        getStructuresAnalysis(team._id)
    }, [team])

    useEffect(() => {
        if (isLoading) return
        const flat = Object.values(structureAnalysis?.analysesByTrajectory || {}).flat()
        setData(flat)
    }, [isLoading, structureAnalysis])

    const handleMenuAction = (action: string, item: any) => {
        switch (action) {
            case 'view':
                break
            case 'delete':
                break
        }
    }

    const getMenuOptions = (item: any) => [
        ['View', RiEyeLine, () => handleMenuAction('view', item)],
        ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
    ]

    const columns: ColumnConfig[] = [
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
    ]

    return (
        <DocumentListing
            title='Structure Analysis'
            breadcrumbs={['Dashboard', 'Structure Analysis']}
            columns={columns}
            data={data}
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            showSearch={true}
            emptyMessage='No structure analyses found'
        />
    )
}

export default StructureAnalysisListing
