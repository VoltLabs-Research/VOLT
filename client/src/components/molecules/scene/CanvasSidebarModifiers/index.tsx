import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Skeleton } from '@mui/material';

import { PiEngine, PiSelectionThin } from 'react-icons/pi';
import { CiImageOn } from 'react-icons/ci';
import { IoColorPalette } from 'react-icons/io5';
import { VscPulse } from 'react-icons/vsc';
import { RiSliceFill } from 'react-icons/ri';

import CanvasSidebarOption from '@/components/atoms/scene/CanvasSidebarOption';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';

import { useTrajectoryStore } from '@/features/trajectory/stores';
import { useUIStore, type ActiveModifier } from '@/stores/slices/ui';
import { usePluginStore } from '@/features/plugins/stores/plugin-slice';

import useLogger from '@/hooks/core/use-logger';

import './CanvasSidebarModifiers.css';

type ModifierOption = {
  Icon: React.ComponentType<any>;
  title: string;
  modifierId: string;
  isPlugin: boolean;
  pluginId?: string;
  pluginModifierId?: string; // slug
};

const SKELETON_ROWS = 6;

const CanvasSidebarModifiers = () => {
  const logger = useLogger('canvas-sidebar-modifiers');
  const navigate = useNavigate();

  // UI store (solo lo necesario)
  const activeModifiers = useUIStore((s) => s.activeModifiers);
  const toggleModifier = useUIStore((s) => s.toggleModifier);
  const setShowRenderConfig = useUIStore((s) => s.setShowRenderConfig);

  // Plugin store (solo lo necesario)
  const modifiers = usePluginStore((s) => s.modifiers);

  // Trajectory
  const trajectory = useTrajectoryStore((s) => s.trajectory);
  const trajectoryId = trajectory?._id;

  // Bootstrap loading local (por defecto TRUE)
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  // Track activations (sin re-renders extra)
  const prevActiveRef = useRef<ActiveModifier[]>(activeModifiers);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapLoading(true);

      try {
        const limit = 200;

        const snapshot0 = usePluginStore.getState();
        if (snapshot0.modifiers.length > 0 && !snapshot0.loading) {
          if (!cancelled) setBootstrapLoading(false);
          return;
        }

        // Page 1
        await usePluginStore.getState().fetchPlugins({ page: 1, limit, force: true });

        // Paginación completa
        let meta = usePluginStore.getState().listingMeta;
        let page = 1;

        while (meta?.hasMore) {
          page += 1;
          await usePluginStore.getState().fetchPlugins({ page, limit, append: true, force: true });
          meta = usePluginStore.getState().listingMeta;
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

    const prev = prevActiveRef.current.map(m => m.key);
    const current = activeModifiers.map(m => m.key);
    const justActivated = current.filter((key) => !prev.includes(key));

    for (const modifierKey of justActivated) {
      logger.log('Modifier activated:', modifierKey);

      if (modifierKey === 'raster') {
        navigate('/raster/' + trajectoryId);
      } else if (modifierKey === 'render-settings') {
        setShowRenderConfig(true);
      }
    }

    prevActiveRef.current = activeModifiers;
  }, [activeModifiers, trajectoryId, logger, navigate, setShowRenderConfig]);

  const activeSet = useMemo(() => {
    return new Set(activeModifiers.map(m => m.key));
  }, [activeModifiers]);

  const isActive = useCallback((modifierId: string) => {
    return activeSet.has(modifierId);
  }, [activeSet]);

  const staticOptions = useMemo<ModifierOption[]>(() => ([
    { Icon: IoColorPalette, title: 'Color Coding', modifierId: 'color-coding', isPlugin: false },
    { Icon: RiSliceFill, title: 'Slice Plane', modifierId: 'slice-plane', isPlugin: false },
    { Icon: PiSelectionThin, title: 'Particle Selection', modifierId: 'particle-filter', isPlugin: false },
    { Icon: PiEngine, title: 'Render Settings', modifierId: 'render-settings', isPlugin: false },
    { Icon: VscPulse, title: 'Performance Monitor', modifierId: 'performance-monitor', isPlugin: false },
    { Icon: CiImageOn, title: 'Raster Frames', modifierId: 'raster', isPlugin: false },
  ]), []);

  const pluginOptions = useMemo<ModifierOption[]>(() => {
    return modifiers.map((modifier) => ({
      title: modifier.name,
      modifierId: modifier.plugin._id,  
      pluginId: modifier.plugin._id,
      pluginModifierId: modifier.plugin.slug,
      Icon: modifier.icon
        ? () => <DynamicIcon iconName={modifier.icon ?? ''} />
        : PiEngine,
      isPlugin: true
    }));
  }, [modifiers]);

  // Lista final (memo estable)
  const allModifiers = useMemo<ModifierOption[]>(() => {
    // si quieres que los plugins aparezcan arriba, mantenemos este orden
    return [...pluginOptions, ...staticOptions];
  }, [pluginOptions, staticOptions]);

  const handleToggle = useCallback((option: ModifierOption) => {
    if (option.isPlugin) {
      toggleModifier(option.modifierId, option.pluginId, option.pluginModifierId);
    } else {
      toggleModifier(option.modifierId);
    }
  }, [toggleModifier]);

  // Skeleton UI (MUI) mientras bootstrapLoading
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
            activeOption={isActive(option.modifierId)}
            onSelect={handleToggle}
          />
        ))}
      </div>
    </div>
  );
};

export default CanvasSidebarModifiers;
