import { useEffect, useState } from 'react';
import { RiDeleteBin6Line, RiEyeLine } from "react-icons/ri";
import DocumentListing from '@/components/organisms/DocumentListing';
import useTrajectoryStore from '@/stores/trajectories';
import useTeamStore from '@/stores/team';

const StructureAnalysisListing = () => {
    const getStructuresAnalysis = useTrajectoryStore((state) => state.getStructureAnalysis);
    const team = useTeamStore((state) => state.selectedTeam);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const structureAnalysis = useTrajectoryStore((state) => state.structureAnalysis);
    const [data, setData] = useState([]);

    useEffect(() => {
        if (!team?._id) return;
        getStructuresAnalysis(team._id);
    }, [team]);

    useEffect(() => {
        if(isLoading) return;
        const flat = Object.values(structureAnalysis?.analysesByTrajectory || {}).flat();
        setData(flat);
    }, [isLoading, structureAnalysis]);

    const handleMenuAction = (action: string, item: any) => {
        switch (action) {
            case 'view':
                break;
            case 'delete':
                break;
            default:
                break;
        }
    };

    const getMenuOptions = (item: any) => {
        return [
            ['View', RiEyeLine, () => handleMenuAction('view', item)],
            ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
        ];
    };

    const columns = [
        { title: 'Trajectory', key: 'trajectory' },
        { title: 'Method', key: 'analysisMethod' },
        { title: 'Identification Rate', key: 'identificationRate' },
        { title: 'Total Identified', key: 'identifiedStructures' },
        { title: 'Total Unidentified', key: 'unidentifiedStructures' },
        { title: 'Total Atoms', key: 'totalAtoms' },
        { title: 'Timestep', key: 'timestep' },
        { title: 'Creation Date', key: 'createdAt' }
    ];

    return (
        <DocumentListing
            title="Structure Analysis"
            breadcrumbs={['Dashboard', 'Structure Analysis']}
            columns={columns}
            data={data}
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            showSearch={true}
            searchPlaceholder="Search analyses..."
            emptyMessage="No structure analyses found"
        />
    );
};

export default StructureAnalysisListing;