import React from 'react';
import type { AnalysisResult, Dislocation } from '../types/index';

interface DislocationResultsProps {
    analysis: AnalysisResult;
    onDislocationSelect?: (dislocation: Dislocation) => void;
    selectedDislocationId?: string;
}

const DislocationResults: React.FC<DislocationResultsProps> = ({ analysis, onDislocationSelect }) => {
    const formatBurgersVector = (vector: number[]): string => {
        return `[${vector.map(v => v.toFixed(3)).join(', ')}]`;
    };

    const formatLength = (length: number | undefined | null): string => {
        return(length !== null && length !== undefined && !isNaN(length)) ? length.toFixed(2) : 'N/A';
    };

    const getDislocationTypeName = (type: number | string): string => {
        if(typeof type === 'number'){
            switch(type){
                case 0:
                    return 'Edge';
                case 1:
                    return 'Screw';
                case 2:
                    return 'Mixed';
                default:
                    return 'Unknown';
            }
        }
        return typeof type === 'string' ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown';
    };

    const getDislocationTypeColor = (type: number | string): string => {
        let typeStr: string;
        if(typeof type === 'number'){
            switch(type){
                case 0: 
                    typeStr = 'edge'; 
                    break;
                case 1: 
                    typeStr = 'screw'; 
                    break;
                case 2: 
                    typeStr = 'mixed'; 
                    break;
                default: 
                    typeStr = 'unknown'; 
                    break;
            }
        }else{
            typeStr = type.toLowerCase();
        }

        switch(typeStr){
            case 'edge': 
                return '#3b82f6';
            case 'screw': 
                return '#ef4444';
            case 'mixed': 
                return '#8b5cf6'; 
            case 'loop': 
                return '#10b981';
            default: 
                return '#6b7280';
        }
    };
    
    return (
        <div className='dislocation-results-container'>
            <div className='dislocation-results-header-container'>
                <h3 className='dislocation-results-header-stats'>{analysis.dislocations.length} dislocations for timestep {analysis.timestep} ({analysis.execution_time.toFixed(2)}s)</h3>
            </div>
            <div className='dislocation-results-body-container'>
                {analysis.dislocations.map((dislocation, index) => (
                    <div
                        key={dislocation.id}
                        className='dislocation-result-item'
                        onClick={() => onDislocationSelect?.(dislocation)}
                    >   
                        <div className='dislocation-result-item-header-container'>
                            <div style={{ backgroundColor: getDislocationTypeColor(dislocation.type) }} className='dislocation-result-type'></div>
                            <h3 className='dislocation-result-item-title'>Dislocation #{index + 1} ({getDislocationTypeName(dislocation.type)})</h3>
                        </div>
                        <div className='dislocation-result-data-container'>
                            <div className='dislocation-result-data'>
                                <h4 className='dislocation-result-data-title'>Length:</h4>
                                <p className='dislocation-result-data-value'>{formatLength(dislocation.length)} Å</p>
                            </div>
                            <div className='dislocation-result-data'>
                                <h4 className='dislocation-result-data-title'>Core atoms:</h4>
                                <p className='dislocation-result-data-value'>{dislocation.core_atoms?.length || 0}</p>
                            </div>
                            <div className='dislocation-result-data'>
                                <h4 className='dislocation-result-data-title'>Burgers vector:</h4>
                                <p className='dislocation-result-data-value'>{formatBurgersVector(dislocation.burgers_vector)}</p>
                            </div>
                            {dislocation.segment_count && (
                                <div className='dislocation-result-data'>
                                    <h4 className='dislocation-result-data-title'>Segments:</h4>
                                    <p className='dislocation-result-data-value'>{dislocation.segment_count}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DislocationResults;
