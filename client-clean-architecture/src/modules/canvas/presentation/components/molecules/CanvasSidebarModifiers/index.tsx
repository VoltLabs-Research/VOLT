import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';

import { PiEngine, PiSelectionThin } from 'react-icons/pi';
import { CiImageOn } from 'react-icons/ci';
import { IoColorPalette } from 'react-icons/io5';
import { VscPulse } from 'react-icons/vsc';
import { RiSliceFill } from 'react-icons/ri';

import CanvasSidebarOption from '@/modules/canvas/presentation/components/atoms/CanvasSidebarOption';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';

import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';

import '@/modules/canvas/presentation/components/molecules/CanvasSidebarModifiers/CanvasSidebarModifiers.css';

type ModifierOption = {
  Icon: React.ComponentType<any>;
  title: string;
  modifierId: string;
  isPlugin: boolean;
  pluginId?: string;
  pluginModifierId?: string;
};

const SKELETON_ROWS = 6;

const CanvasSidebarModifiers = () => {
  const navigate = useNavigate();
  const { searchParams, updateSearchParams } = useSearchParamsState();

  const {
    selectedIds: activeModifiers,
    toggleSelection,
    isSelected
  } = useSelectionParams({ paramName: 'modifiers' });

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

  const staticOptions = useMemo<ModifierOption[]>(() => ([
    { Icon: IoColorPalette, title: 'Color Coding', modifierId: 'color-coding', isPlugin: false },
    { Icon: RiSliceFill, title: 'Slice Plane', modifierId: 'slice-plane', isPlugin: false },
    { Icon: PiSelectionThin, title: 'Particle Selection', modifierId: 'particle-filter', isPlugin: false },
    { Icon: PiEngine, title: 'Render Settings', modifierId: 'render-settings', isPlugin: false },
    { Icon: VscPulse, title: 'Performance Monitor', modifierId: 'performance-monitor', isPlugin: false },
    { Icon: CiImageOn, title: 'Raster Frames', modifierId: 'raster', isPlugin: false },
  ]), []);

  const pluginOptions = useMemo<ModifierOption[]>(() => {
    return modifiers.map((modifier: any) => ({
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

  const allModifiers = useMemo<ModifierOption[]>(() => {
    return [...pluginOptions, ...staticOptions];
  }, [pluginOptions, staticOptions]);

  const handleToggle = useCallback((option: ModifierOption) => {
    if (option.isPlugin) {
      const currentPlugin = searchParams.get('plugin');
      const newPlugin = `${option.pluginId}:${option.pluginModifierId}`;
      updateSearchParams({ plugin: currentPlugin === newPlugin ? null : newPlugin });
    } else if (option.modifierId === 'render-settings') {
      const next = isSelected(option.modifierId)
        ? activeModifiers
        : Array.from(new Set([...activeModifiers, option.modifierId]));
      updateSearchParams({
        modifiers: next.length === 0 ? null : next.join(','),
        renderConfig: 'true'
      });
    } else {
      toggleSelection(option.modifierId);
    }
  }, [searchParams, updateSearchParams, toggleSelection, isSelected, activeModifiers]);

  const isActive = useCallback((option: ModifierOption) => {
    if (option.isPlugin) {
      return searchParams.get('plugin') === `${option.pluginId}:${option.pluginModifierId}`;
    }
    return isSelected(option.modifierId);
  }, [searchParams, isSelected]);

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
