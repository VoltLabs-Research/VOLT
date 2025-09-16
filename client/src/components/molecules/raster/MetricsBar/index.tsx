import React from 'react';
import type { MetricsBarProps } from '@/types/raster';
import MetricsBarSkeleton from '@/components/atoms/raster/MetricsBarSkeleton';
import MetricItem from '@/components/atoms/raster/MetricItem';
import { motion } from 'framer-motion';
import { IoCloseOutline } from 'react-icons/io5';
import { GoPlus } from 'react-icons/go';

const StructureAnalysisPlaceholder: React.FC = () => (
    <motion.div
        className="raster-metric-item modifier-result"
        initial={{ backgroundColor: "#0d0d0d", boxShadow: "0 0 0 rgba(0,0,0,0)" }}
        animate={{
            backgroundColor: ["#0d0d0d", "#121212", "#0d0d0d"],
            boxShadow: [
            "0 0 0 rgba(34,211,238,0)",
            "0 0 0 rgba(34,211,238,0.18)",
            "0 0 0 rgba(34,211,238,0)"
            ]
        }}
        transition={{ duration: 4.2, ease: "easeInOut", repeat: Infinity }}
        whileHover={{
            scale: 1.02,
            boxShadow: "0 0 0 1px rgba(34,211,238,.3), 0 10px 30px rgba(0,0,0,.35)"
        }}
    >
    <motion.span
        className="metric-aurora"
        aria-hidden
        animate={{
          rotate: [0, -10, 6, 0],
          opacity: [0.16, 0.32, 0.22, 0.16],
          scale: [1, 1.04, 1.01, 1]
        }}
        transition={{ duration: 7.2, ease: "easeInOut", repeat: Infinity }}
    />
    <span className="raster-metric-label">Structure Analysis</span>
    <b className="raster-metric-value">
        <i className="raster-metric-icon">
          <GoPlus size={18} />
        </i>
    </b>
  </motion.div>
);

const DislocationToggleButton: React.FC<{
  isDislocationVisible: boolean;
  onToggle: () => void;
}> = ({ isDislocationVisible, onToggle }) => (
    <motion.button
        type="button"
        className={`raster-metric-item modifier-result ${isDislocationVisible ? "active" : ""}`}
        onClick={onToggle}
        aria-pressed={isDislocationVisible}
        initial={false}
        animate={{
        backgroundColor: isDislocationVisible ? "#161616" : "#0d0d0d",
        boxShadow: isDislocationVisible
            ? "0 0 0 1px rgba(99,102,241,.45), 0 10px 30px rgba(0,0,0,.35)"
            : "0 0 0 rgba(0,0,0,0)"
        }}
        whileHover={{
        scale: 1.02,
        boxShadow: "0 0 0 1px rgba(99,102,241,.35), 0 10px 30px rgba(0,0,0,.35)"
        }}
        whileTap={{ scale: 0.98 }}
        style={{ cursor: "pointer" }}
    >
        <motion.span
            className="metric-aurora"
            aria-hidden
            animate={{
                rotate: [0, 8, -6, 0],
                opacity: [0.14, 0.34, 0.2, 0.14],
                scale: [1, 1.05, 1.02, 1]
            }}
            transition={{ duration: 6.5, ease: "easeInOut", repeat: Infinity }}
        />

        <span className="raster-metric-label">Dislocation Analysis</span>
        <b className="raster-metric-value">
            <i className="raster-metric-icon">
                {isDislocationVisible ? <IoCloseOutline size={18} /> : <GoPlus size={18} />}
            </i>
        </b>
    </motion.button>
);

const MetricsBar: React.FC<MetricsBarProps> = ({ items, isLoading, showDislocations, onToggleDislocations }) => {
    if(isLoading) return <MetricsBarSkeleton count={4} />;

    return (
        <div className='raster-metrics-bar'>
            <div className='raster-metrics-list'>
                {items.map((item) => (
                    <MetricItem key={item.key} {...item} />
                ))}

                <DislocationToggleButton isDislocationVisible={showDislocations} onToggle={onToggleDislocations} />
                <StructureAnalysisPlaceholder />
            </div>
        </div>
    );
};

export default MetricsBar;