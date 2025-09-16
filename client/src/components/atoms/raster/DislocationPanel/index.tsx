import React from 'react';
import type { DislocationPanelProps } from '@/types/raster';
import { AnimatePresence, motion } from 'framer-motion';
import DislocationResultsSkeleton from '@/components/atoms/DislocationResultsSkeleton';
import DislocationResults from '@/components/atoms/DislocationResults';

const DislocationPanel: React.FC<DislocationPanelProps> = ({ dislocationData, show, isLoading }) => {
    return (
        <AnimatePresence initial={false} mode='popLayout'>
            {show && (
                <motion.div
                    key='dislocation-panel'
                    layout
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden', marginBottom: '.5rem' }}
                >
                    {isLoading ? (
                        <DislocationResultsSkeleton />
                    ) : (
                        dislocationData && <DislocationResults title='Dislocations' dislocationData={dislocationData} />
                    )}
                </motion.div>
            )}
        </AnimatePresence>  
    );
};

export default DislocationPanel;