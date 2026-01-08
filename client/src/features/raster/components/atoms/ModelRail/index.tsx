import React, { useMemo, useState } from 'react';
import type { ModelRailProps } from '@/types/raster';
import { AnimatePresence, motion } from 'framer-motion';
import ModelRailItem from '@/features/raster/components/atoms/ModelRailItem';

const ModelRail: React.FC<ModelRailProps> = ({ modelsForCurrentFrame, selectedModel, onModelChange }) => {
  const [open, setOpen] = useState(false);

  if(!modelsForCurrentFrame || !modelsForCurrentFrame.length) return null;

  const { selectedThumb, restThumbs } = useMemo(() => {
    const sel = modelsForCurrentFrame.find((s) => s.model === selectedModel) || modelsForCurrentFrame[0];
    return { selectedThumb: sel, restThumbs: modelsForCurrentFrame.filter((s) => s.model !== sel.model) };
  }, [modelsForCurrentFrame, selectedModel]);

  if(!selectedThumb) return null;

  return(
    <motion.div
      className="raster-rail-container p-absolute y-auto"
      style={{ width: 132 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      initial={false}
      transition={{ duration: 0.2 }}
    >
      <ModelRailItem scene={selectedThumb} isSelected onClick={onModelChange} />
      <AnimatePresence>
        {open &&
          restThumbs.map((s) => (
            <ModelRailItem key={`opt-${s.frame}-${s.model}`} scene={s} isSelected={false} onClick={onModelChange} />
          ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default ModelRail;
