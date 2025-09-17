import React from 'react';
import { Skeleton } from '@mui/material';

const StructureAnalysisResultsSkeleton: React.FC = () => {
    return (
        <div className='structure-analysis-results-container'>
            <div className='structure-type-legend' style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`legend-skel-${i}`} className='type-legend-item' style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Skeleton 
                            variant='rounded'
                            animation='wave'
                            width={12}
                            height={12}
                            sx={{
                                borderRadius: '2px',
                                bgcolor: 'rgba(255, 255, 255, 0.2)'
                            }}
                        />
                        <Skeleton 
                            variant='text'
                            animation='wave'
                            width={140}
                            height={18}
                            sx={{
                                borderRadius: '4px',
                                bgcolor: 'rgba(255, 255, 255, 0.15)'
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StructureAnalysisResultsSkeleton;
