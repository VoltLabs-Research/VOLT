import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StructureAnalysisResultsSkeleton from '@/components/atoms/StructureAnalysisResultsSkeleton';
import StructureAnalysisResults from '@/components/atoms/StructureAnalysisResults';
import type { StructureAnalysis } from '@/services/structure-analysis';

interface StructureAnalysisPanelProps {
    structureAnalysisData: StructureAnalysis | null;
    show: boolean;
    isLoading: boolean;
}

const StructureAnalysisPanel: React.FC<StructureAnalysisPanelProps> = ({ structureAnalysisData, show, isLoading }) => {
    return (
        <AnimatePresence initial={false} mode='popLayout'>
            {show && (
                <motion.div
                    key='structure-analysis-panel'
                    layout
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden', marginBottom: '.5rem' }}
                >
                    {isLoading ? (
                        <StructureAnalysisResultsSkeleton />
                    ) : (
                        structureAnalysisData && <StructureAnalysisResults 
                            title='Structure Analysis' 
                            structureAnalysis={structureAnalysisData} 
                        />
                    )}
                </motion.div>
            )}
        </AnimatePresence>  
    );
};

export default StructureAnalysisPanel;
