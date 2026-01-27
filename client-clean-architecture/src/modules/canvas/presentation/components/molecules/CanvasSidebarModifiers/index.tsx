import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Skeleton } from '@mui/material';

import { PiEngine, PiSelectionThin } from 'react-icons/pi';
import { CiImageOn } from 'react-icons/ci';
import { IoColorPalette } from 'react-icons/io5';
import { VscPulse } from 'react-icons/vsc';
import { RiSliceFill } from 'react-icons/ri';

import CanvasSidebarOption from '@/modules/canvas/presentation/components/atoms/CanvasSidebarOption';
import DynamicIcon from '@/shared/presentation/components/atoms/common/DynamicIcon';

import { useTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { useUIStore, type ActiveModifier } from '@/shared/presentation/stores/slices/ui';
import { usePlugins } from '@/modules/plugins/presentation/hooks/use-plugin-queries';
import { PluginStatus } from '@/types/plugin';

import useLogger from '@/shared/presentation/hooks/core/use-logger';

import '@/modules/canvas/presentation/components/molecules/CanvasSidebarModifiers/CanvasSidebarModifiers.css';

type ModifierOption = {
  Icon: React.ElementType;
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
  const { trajectoryId } = useParams<{ trajectoryId: string }>();

  // UI store
  const activeModifiers = useUIStore((s) => s.activeModifiers);
  const toggleModifier = useUIStore((s) => s.toggleModifier);
  const setShowRenderConfig = useUIStore((s) => s.setShowRenderConfig);

  // Plugins query - Fetch all plugins for modifiers sidebar
  const { plugins, isLoading: isPluginsLoading } = usePlugins({ limit: 1000, status: PluginStatus.PUBLISHED });

  // Trajectory query
  const { data: trajectory } = useTrajectory(trajectoryId!);

  // Track activations
  const prevActiveRef = useRef<ActiveModifier[]>(activeModifiers);

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
    // Only show plugins that are marked as modifiers
    return plugins
      .filter(p => p.modifier)
      .map((plugin) => ({
        title: plugin.modifier?.name || plugin.slug,
        modifierId: plugin._id,  
        pluginId: plugin._id,
        pluginModifierId: plugin.slug,
        Icon: plugin.modifier?.icon
          ? () => <DynamicIcon iconName={plugin.modifier?.icon ?? ''} />
          : PiEngine,
        isPlugin: true
      }));
  }, [plugins]);

  const allModifiers = useMemo<ModifierOption[]>(() => {
    return [...pluginOptions, ...staticOptions];
  }, [pluginOptions, staticOptions]);

  const handleToggle = useCallback((option: ModifierOption) => {
    if (option.isPlugin) {
      toggleModifier(option.modifierId, option.pluginId, option.pluginModifierId);
    } else {
      toggleModifier(option.modifierId);
    }
  }, [toggleModifier]);

  if (isPluginsLoading) {
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
            option={option as any}
            isLoading={false}
            activeOption={isActive(option.modifierId)}
            onSelect={handleToggle as any}
          />
        ))}
      </div>
    </div>
  );
};

export default CanvasSidebarModifiers;
