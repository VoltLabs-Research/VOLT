import { useMemo, useState } from 'react';
import DocumentListingTable from '@/components/molecules/DocumentListingTable';
import type { ColumnConfig } from '@/components/organisms/DocumentListing';
import WindowIcons from '@/components/molecules/WindowIcons';
import Draggable from '@/components/atoms/Draggable';
import './DislocationsComparisonTable.css';

export type DislocationsComparisonTableProps = {
    trajectoryId?: string;
    timestep?: number;
    title?: string;
    onClose?: () => void;
    decimals?: number;
    analysesNames?: Array<{ 
        _id: string; 
        name: string;
        RMSD?: number;
        maxTrialCircuitSize?: number;
        circuitStretchability?: number;
        identificationMode?: string;
    }>;
    analysisDislocationsById?: Record<string, any[]>;
};

const DislocationsComparisonTable = ({
    timestep,
    title = 'Dislocations Comparison',
    onClose,
    decimals = 3,
    analysesNames = [],
    analysisDislocationsById = {}
}: DislocationsComparisonTableProps) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [sortColumn, setSortColumn] = useState<string | null>('rmsd');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (columnKey: string) => {
        if (sortColumn === columnKey) {
            // Toggle direction if clicking the same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new column and default to ascending
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    };

    const columns: ColumnConfig[] = useMemo(() => {
        const getSortIcon = (columnKey: string) => {
            if (sortColumn !== columnKey) return ' ↕';
            return sortDirection === 'asc' ? ' ↑' : ' ↓';
        };

        return [
            { 
                key: 'analysisName', 
                title: `Analysis${getSortIcon('analysisName')}`, 
                skeleton: { variant: 'text', width: 150 },
                sortable: true
            },
            { 
                key: 'rmsd', 
                title: `RMSD${getSortIcon('rmsd')}`, 
                skeleton: { variant: 'text', width: 90 },
                render: (v: number, row: any) => {
                    // Show N/A if identificationMode is CNA
                    if (row?.identificationMode === 'CNA') {
                        return 'N/A';
                    }
                    return v !== undefined ? v.toFixed(decimals) : 'N/A';
                },
                sortable: true
            },
            { 
                key: 'segments', 
                title: `Segments${getSortIcon('segments')}`, 
                skeleton: { variant: 'text', width: 100 },
                render: (v: number) => v !== undefined ? String(v) : 'N/A',
                sortable: true
            },
            { 
                key: 'length', 
                title: `Length (Å)${getSortIcon('length')}`, 
                skeleton: { variant: 'text', width: 120 },
                render: (v: number) => v !== undefined ? v.toFixed(decimals) : 'N/A',
                sortable: true
            },
            { 
                key: 'averageLength', 
                title: `Average Length (Å)${getSortIcon('averageLength')}`, 
                skeleton: { variant: 'text', width: 140 },
                render: (v: number) => v !== undefined ? v.toFixed(decimals) : 'N/A',
                sortable: true
            },
            { 
                key: 'circuitSize', 
                title: `Circuit Size${getSortIcon('circuitSize')}`, 
                skeleton: { variant: 'text', width: 110 },
                render: (v: number) => v !== undefined ? String(Math.round(v)) : 'N/A',
                sortable: true
            },
            { 
                key: 'circuitStretchability', 
                title: `Circuit Stretchability${getSortIcon('circuitStretchability')}`, 
                skeleton: { variant: 'text', width: 160 },
                render: (v: number) => v !== undefined ? String(Math.round(v)) : 'N/A',
                sortable: true
            },
        ];
    }, [decimals, sortColumn, sortDirection]);

    // Build data from all analyses
    const tableData = useMemo(() => {
        const data = analysesNames.map((analysis) => {
            const dislocationsList = analysisDislocationsById[analysis._id] || [];
            
            // Find dislocation data for current timestep
            const dislocationData = dislocationsList.find(
                (d) => Number.isFinite(d?.timestep) && d.timestep === timestep
            );

            return {
                analysisName: analysis.name || analysis._id,
                rmsd: analysis.RMSD,
                identificationMode: analysis.identificationMode,
                segments: dislocationData?.totalSegments,
                length: dislocationData?.totalLength,
                averageLength: dislocationData?.averageSegmentLength,
                circuitSize: analysis.maxTrialCircuitSize,
                circuitStretchability: analysis.circuitStretchability
            };
        });

        // Apply sorting
        if (sortColumn) {
            data.sort((a, b) => {
                const aVal = a[sortColumn as keyof typeof a];
                const bVal = b[sortColumn as keyof typeof b];

                // Handle undefined/null values
                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;

                // String comparison
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortDirection === 'asc' 
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                }

                // Numeric comparison
                const numA = Number(aVal);
                const numB = Number(bVal);
                return sortDirection === 'asc' ? numA - numB : numB - numA;
            });
        }

        return data;
    }, [analysesNames, analysisDislocationsById, timestep, sortColumn, sortDirection]);

    return (
        <Draggable
            enabled={!isMaximized}
            bounds='viewport'
            axis='both'
            doubleClickToDrag={true}
            handle='.dislocations-comparison-table-drag-handle'
            scaleWhileDragging={0.95}
            className='dislocations-comparison-table-draggable'
            resizable={true}
            minWidth={800}
            minHeight={400}
        >
            <div className={`dislocations-comparison-table-container primary-surface ${isMaximized ? 'maximized' : ''}`}>
                <div className='dislocations-comparison-table-header-container'>
                    <WindowIcons 
                        onClose={onClose}
                        onExpand={() => setIsMaximized(!isMaximized)}
                    />
                    <h3 className='dislocations-comparison-table-header-title dislocations-comparison-table-drag-handle'>
                        {title}
                        {timestep !== undefined && (
                            <span className='dislocations-comparison-table-timestep'>
                                {' '}· Frame {timestep}
                            </span>
                        )}
                    </h3>
                </div>

                <div className='dislocations-comparison-table-body-container'>
                    <DocumentListingTable 
                        columns={columns} 
                        data={tableData} 
                        isLoading={false}
                        onCellClick={(col: any) => {
                            if (col.sortable) {
                                handleSort(col.key);
                            }
                        }}
                    />
                </div>
            </div>
        </Draggable>
    );
};

export default DislocationsComparisonTable;
