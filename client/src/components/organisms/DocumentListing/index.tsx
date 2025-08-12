import React, { useEffect, useState } from 'react';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import useTrajectoryStore from '@/stores/trajectories';
import useTeamStore from '@/stores/team';
import './DocumentListing.css';

const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined) return '—';
    switch (key) {
        case 'createdAt':
            return formatTimeAgo(value);
        case 'identificationRate':
            return `${Number(value).toFixed(2)}%`;
        case 'trajectory':
            return typeof value === 'object' ? (value.name ?? '—') : String(value);
        default:
            return String(value);
    }
};

const DocumentListing = ({ title }) => {
    const getStructuresAnalysis = useTrajectoryStore((state) => state.getStructureAnalysis);
    const team = useTeamStore((state) => state.selectedTeam);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const structureAnalysis = useTrajectoryStore((state) => state.structureAnalysis);
    const [values, setValues] = useState<any[]>([]);

    useEffect(() => {
        if (!team?._id) return;
        getStructuresAnalysis(team._id);
    }, [team]);

    useEffect(() => {
        if (isLoading) return;
        const flat = Object.values(structureAnalysis?.analysesByTrajectory || {}).flat() as any[];
        console.log(flat);
        setValues(flat);
    }, [isLoading, structureAnalysis]);

    const rows = [
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
        <div className='document-listing-container'>
            <div className='document-listing-header-container'>
                <div className='document-listing-header-title-container'>
                    <h3 className='document-listing-header-title'>{title}</h3>
                </div>
            </div>

            <div className='document-listing-body-container'>
                <div className='document-listing-table-container'>
                    <div className='document-listing-table-header-container'>
                        {rows.map((row) => (
                            <div className='document-listing-cell header-cell' key={row.key}>
                                <h4 className='document-listing-cell-title'>{row.title}</h4>
                            </div>
                        ))}
                    </div>

                    <div className='document-listing-table-body-container'>
                        <div className='document-listing-table-row-container'>
                            {rows.map((row) => (
                                <div className='document-listing-row' key={row.key}>
                                    {values.map((item, idx) => (
                                        <div
                                            className='document-listing-cell'
                                            key={item?._id ?? `${row.key}-${idx}`}
                                            title={String(item?.[row.key] ?? '')}
                                            >
                                                <span>{formatValue(row.key, item?.[row.key])}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='document-listing-table-footer-container' />
                </div>
            </div>
        </div>
    );
};

export default DocumentListing;