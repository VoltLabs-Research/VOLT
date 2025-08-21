import React, { useEffect, useState } from 'react';
import { RxDotsHorizontal } from "react-icons/rx";
import { RiListUnordered } from "react-icons/ri";
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
        <div className='document-listing-container'>
            <div className='document-listing-header-container'>
                <div className='document-listing-header-top-container'>
                    <div className='breadcrumbs-container'>
                        {['Dashboard', 'Structure Analysis'].map((name, index) => (
                            <div className='breadcrumb-item-container' key={index}>
                                <p className='breadcrumb-item-name'>{name}</p>
                            </div>
                        ))}
                    </div>
                    <div className='document-listing-header-title-container'>
                        <h3 className='document-listing-header-title'>{title}</h3>
                        <i className='document-listing-header-icon-container'>
                            <RxDotsHorizontal />
                        </i>
                    </div>
                </div>
                
                <div className='document-listing-header-tabs-container'>
                    <div className='document-listing-header-tab-container'>
                        <i className='document-listing-header-tab-icon-container'>
                            <RiListUnordered />
                        </i>
                        <p className='document-listing-header-tab-name'>List</p>
                    </div>
                </div>
            </div>

            <div className='document-listing-body-container'>
                <div className='document-listing-table-container'>
                    <div className='document-listing-table-header-container'>
                        {columns.map((column) => (
                            <div className='document-listing-cell header-cell' key={column.key}>
                                <h4 className='document-listing-cell-title'>{column.title}</h4>
                            </div>
                        ))}
                    </div>

                    <div className='document-listing-table-body-container'>
                        {values.map((item, idx) => (
                            <div className='document-listing-table-row-container' key={item?._id ?? idx}>
                                {columns.map((column) => (
                                    <div
                                        className='document-listing-cell'
                                        key={column.key}
                                        title={String(item?.[column.key] ?? '')}
                                    >
                                        <span>{formatValue(column.key, item?.[column.key])}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div className='document-listing-table-footer-container' />
                </div>
            </div>
        </div>
    );
};

export default DocumentListing;