/**
 * Unified StructureAnalysisPanel that supports BOTH previous prop shapes:
 * 1) { configId, timestep, show? }  -> fetches from store by configId+timestep
 * 2) { structureAnalysisData, show, isLoading } -> purely presentational
 */
import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import StructureAnalysisResultsSkeleton from '@/components/atoms/StructureAnalysisResultsSkeleton';
import StructureAnalysisResults from '@/components/atoms/StructureAnalysisResults';
import type { StructureAnalysis } from '@/services/structure-analysis';
import { useStructureAnalysisStore } from '@/stores/structure-analysis';

type PropsVariantFetch = {
  configId?: string;
  timestep: number;
  show?: boolean;
  structureAnalysisData?: never;
  isLoading?: never;
};

type PropsVariantPresent = {
  structureAnalysisData: StructureAnalysis | null;
  show: boolean;
  isLoading: boolean;
  configId?: never;
  timestep?: never;
};

type StructureAnalysisPanelProps = PropsVariantFetch | PropsVariantPresent;

const StructureAnalysisPanel: React.FC<StructureAnalysisPanelProps> = (props) => {
  // Variant detection
  const isPresentational = 'structureAnalysisData' in props;

  // Presentational path
  if (isPresentational) {
    const { structureAnalysisData, show, isLoading } = props;
    return (
      <AnimatePresence initial={false} mode="popLayout">
        {show && (
          <motion.div
            key="structure-analysis-panel"
            layout
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', marginBottom: '.5rem' }}
          >
            {isLoading ? (
              <StructureAnalysisResultsSkeleton />
            ) : (
              structureAnalysisData && <StructureAnalysisResults title="Structure Analysis" structureAnalysis={structureAnalysisData} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Fetching path
  const { configId, timestep, show = true } = props;
  const { structureAnalysesByConfig, loading, fetchStructureAnalysesByConfig } = useStructureAnalysisStore();

  useEffect(() => {
    if (!show || !configId) return;
    if (!structureAnalysesByConfig[configId]) fetchStructureAnalysesByConfig(configId);
  }, [show, configId, structureAnalysesByConfig, fetchStructureAnalysesByConfig]);

  const currentAnalysis = useMemo(() => {
    if (!configId || !structureAnalysesByConfig[configId]) return null;
    return structureAnalysesByConfig[configId].find((a) => a.timestep === timestep) ?? null;
  }, [structureAnalysesByConfig, configId, timestep]);

  const isLoading = loading && !currentAnalysis;
  if (!show) return null;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {show && (
        <motion.div
          key="structure-analysis-panel"
          layout
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: 'hidden', marginBottom: '.5rem' }}
        >
          {isLoading ? (
            <StructureAnalysisResultsSkeleton />
          ) : (
            currentAnalysis && <StructureAnalysisResults structureAnalysis={currentAnalysis} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StructureAnalysisPanel;
