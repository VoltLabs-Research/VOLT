import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';


import CanvasSidebarOption from '@/modules/canvas/presentation/components/atoms/CanvasSidebarOption';

import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import useCanvasUrlState from '@/modules/canvas/presentation/hooks/use-canvas-url-state';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import { buildCanvasModifierOptions, toggleModifierOption, type ModifierOption } from '@/modules/canvas/presentation/modifiers/registry';

import '@/modules/canvas/presentation/components/molecules/CanvasSidebarModifiers/CanvasSidebarModifiers.css';

const SKELETON_ROWS = 6;

const CanvasSidebarModifiers = () => {
  const navigate = useNavigate();
  const {
    pluginParam,
    activeModifiers,
    toggleModifier,
    isModifierSelected,
    setPluginParam,
    setModifiers,
    setRenderConfigOpen
  } = useCanvasUrlState();

  const modifiers = usePluginStore((s) => (s as any).modifiers ?? []);

  const trajectory = useTrajectoryStore((s) => s.trajectory);
  const trajectoryId = trajectory?._id;

  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  const prevActiveRef = useRef<string[]>(activeModifiers);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapLoading(true);

      try {
        const limit = 200;

        const snapshot0 = usePluginStore.getState() as any;
        if (snapshot0.modifiers?.length > 0 && !snapshot0.loading) {
          if (!cancelled) setBootstrapLoading(false);
          return;
        }

        await (usePluginStore.getState() as any).fetchPlugins?.({ page: 1, limit, force: true });

        let meta = (usePluginStore.getState() as any).listingMeta;
        let page = 1;

        while (meta?.hasMore) {
          page += 1;
          await (usePluginStore.getState() as any).fetchPlugins?.({ page, limit, append: true, force: true });
          meta = (usePluginStore.getState() as any).listingMeta;
        }
      } catch (e) {
        console.error('[CanvasSidebarModifiers] bootstrap modifiers failed', e);
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trajectoryId) {
      prevActiveRef.current = activeModifiers;
      return;
    }

    const prev = prevActiveRef.current;
    const justActivated = activeModifiers.filter((key) => !prev.includes(key));

    for (const modifierKey of justActivated) {
      if (modifierKey === 'raster') {
        navigate('/raster/' + trajectoryId);
      }
    }

    prevActiveRef.current = activeModifiers;
  }, [activeModifiers, trajectoryId, navigate]);

  const allModifiers = useMemo<ModifierOption[]>(() => {
    return buildCanvasModifierOptions(modifiers);
  }, [modifiers]);

  const handleToggle = useCallback((option: ModifierOption) => {
    toggleModifierOption(option, {
      activeModifiers,
      pluginParam,
      toggleModifier,
      setPluginParam,
      setModifiers,
      setRenderConfigOpen
    });
  }, [activeModifiers, pluginParam, toggleModifier, setPluginParam, setModifiers, setRenderConfigOpen]);

  const isActive = useCallback((option: ModifierOption) => {
    if (option.isPlugin) {
      return pluginParam === `${option.pluginId}:${option.pluginModifierId}`;
    }
    return isModifierSelected(option.modifierId);
  }, [pluginParam, isModifierSelected]);

  if (bootstrapLoading) {
    return (
      <div className='editor-sidebar-scene-container p-1-5'>
        <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={`modifier-skel-${i}`} className="canvas-sidebar-modifier-skeleton">
              <div className="d-flex items-center gap-05">
                <Skeleton variant="circular" width={18} height={18} />
                <Skeleton variant="text" width={160} height={24} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='editor-sidebar-scene-container p-1-5'>
      <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
        {allModifiers.map((option) => (
          <CanvasSidebarOption
            key={option.modifierId}
            option={option}
            isLoading={false}
            activeOption={isActive(option)}
            onSelect={handleToggle}
          />
        ))}
      </div>
    </div>
  );
};

export default CanvasSidebarModifiers;
