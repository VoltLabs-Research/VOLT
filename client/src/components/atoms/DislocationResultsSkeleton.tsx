import React from 'react';
import EditorWidget from '@/components/organisms/EditorWidget';
import { Skeleton } from '@mui/material';
import { motion } from 'framer-motion';

const DislocationResultsSkeleton: React.FC<{ segments?: number }> = ({ segments = 3 }) => {
    return (
        <EditorWidget className='dislocation-results-container' draggable={false}>
            <div className='dislocation-results-header-container'>
                <Skeleton
                    variant='text'
                    animation='wave'
                    width={220}
                    height={28}
                    sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.16)',
                        borderRadius: '6px'
                    }}
                />

                <div className='dislocation-type-legend' style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.25rem' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton 
                            key={`legend-skel-${i}`}
                            variant='rounded'
                            animation='wave'
                            width={120}
                            height={22}
                            sx={{
                                borderRadius: '9999px',
                                bgcolor: 'rgba(255, 255, 255, 0.08)'
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className='dislocation-results-body-container' style={{ marginTop: '.5rem' }}>
                {Array.from({ length: segments }).map((_, i) => (
                    <motion.div
                        key={`seg-skel-${i}`}
                        className='dislocation-result-item'
                        initial={{ opacity: 0.6 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                        style={{
                            padding: '.75rem',
                            borderRadius: '.75rem',
                            background: 'rgba(255, 255, 255, 0.04)',
                            marginBottom: '.5rem'
                        }}
                    >
                        <div className='dislocation-result-item-header-container' style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <Skeleton
                                variant='circular'
                                animation='wave'
                                width={16}
                                height={16}
                                sx={{ bgcolor: 'rgba(255, 255, 255, 0.18)' }}
                            />

                            <Skeleton
                                variant='text'
                                animation='wave'
                                width={220}
                                height={20}
                                sx={{ bgcolor: 'rgba(255, 255, 255, 0.12)', borderRadius: '4px' }} 
                            />
                        </div>

                        <div
                            className='dislocation-result-data-container'
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: '.5rem',
                                marginTop: '.5rem'
                            }}
                        >
                            {Array.from({ length: 5 }).map((_, j) => (
                                <Skeleton
                                    key={`seg-skel-line-${i}-${j}`}
                                    variant='rounded'
                                    animation='wave'
                                    height={22}
                                    sx={{
                                        borderRadius: '8px',
                                        bgcolor: 'rgba(255, 255, 255, 0.08)'
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className='dislocation-results-summary-container' style={{ display: 'flex', gap: '0.75rem', marginTop: '.5rem' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={`sum-skel-${i}`} className='dislocation-summary-item' style={{ flex: 1 }}>
                        <Skeleton
                            variant='text'
                            animation='wave'
                            width='60%'
                            height={28}
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.16)', borderRadius: '6px' }}
                        />

                        <Skeleton
                            variant='text'
                            animation='wave'
                            width='80%'
                            height={18}
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.10)', borderRadius: '6px' }}
                        />
                    </div>
                ))}
            </div>
        </EditorWidget>
    );
};

export default DislocationResultsSkeleton;