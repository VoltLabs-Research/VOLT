import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LuPanelRight } from "react-icons/lu";
import { BsArrowLeftShort } from 'react-icons/bs';
import { MdKeyboardArrowDown } from 'react-icons/md';
import EditorWidget from '@/components/organisms/EditorWidget';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import useTrajectoryStore from '@/stores/trajectories';
import EditableTrajectoryName from '@/components/atoms/EditableTrajectoryName';
import CanvasSidebarTab from '@/components/atoms/CanvasSidebarTab';
import CanvasSidebarScene from '@/components/molecules/CanvasSidebarScene';
import CanvasSidebarModifiers from '@/components/molecules/CanvasSidebarModifiers';
import useConfigurationStore from '@/stores/editor/configuration';
import useEditorUIStore from '@/stores/ui/editor';
import EffectsControls from '@/components/molecules/scene/EffectsControls';
import EnvironmentControls from '@/components/molecules/scene/EnvironmentControls';
import './EditorSidebar.css';

const MOBILE_BREAKPOINT = 768;

const EditorSidebar = () => {
  const trajectory = useTrajectoryStore((state) => state.trajectory);
  const activeSidebarTab = useConfigurationStore((state) => state.activeSidebarTab);
  const setActiveSidebarTag = useConfigurationStore((state) => state.setActiveSidebarTag);
  const showRenderConfig = useEditorUIStore((state) => state.showRenderConfig);
  const setShowRenderConfig = useEditorUIStore((state) => state.setShowRenderConfig);

  const [collapsed, setCollapsed] = useState(false);

  // Al montar, detectar si está en mobile y colapsar por defecto
  useEffect(() => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      setActiveSidebarTag('Scene');
    };
  }, []);

  const toggleCollapsed = () => setCollapsed((v) => !v);

  return (
    <motion.aside
      className="editor-sidebar-wrapper"
      data-collapsed={collapsed}
      initial={false}
      animate={{ width: collapsed ? 64 : 380 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      aria-label="Editor sidebar"
      aria-expanded={!collapsed}
    >
      <EditorWidget className='editor-sidebar-container' draggable={false}>
        <div className='editor-sidebar-top-container'>
          <div className='editor-sidebar-header-container'>
            <div className='editor-sidebar-trajectory-info-container'>
              <div className='editor-sidebar-trajectory-info-header-container'>
                <div
                  className='editor-sidebar-trajectory-drop-container'
                  data-collapsible="true"
                >
                    {showRenderConfig ? (
                        <div className='editor-sidebar-render-title-container'>
                            <i className='editor-sidebar-render-title-icon-container' onClick={() => setShowRenderConfig(false)}>
                                <BsArrowLeftShort size={30} />
                            </i>

                            <h3 className='editor-sidebar-render-title'>Render Settings</h3>
                        </div>
                    ) : (
                        <>
                            <EditableTrajectoryName
                                trajectory={trajectory}
                                className='editor-sidebar-trajectory-name'
                            />

                            <i className='editor-sidebar-trajectory-drop-icon-container'>
                                <MdKeyboardArrowDown />
                            </i>
                        </>
                    )}
                </div>

                <button
                  type="button"
                  className='editor-sidebar-toggle-btn'
                  onClick={toggleCollapsed}
                  aria-label={collapsed ? 'Expandir panel' : 'Contraer panel'}
                  title={collapsed ? 'Expandir' : 'Contraer'}
                >
                  <LuPanelRight
                    className={`editor-sidebar-toggle-icon ${collapsed ? 'rotated' : ''}`}
                  />
                </button>
              </div>
                
                {!showRenderConfig && (
                    <p className='editor-sidebar-header-team-name' data-collapsible="true">
                        {trajectory?.team?.name}
                    </p>
                )}
            </div>
          </div>
            
            {!showRenderConfig && (
                <div className='editor-sidebar-options-wrapper-container' data-collapsible="true">
                    <div className='editor-sidebar-options-container'>
                        {['Scene', 'Modifiers'].map((option, index) => (
                            <CanvasSidebarTab option={option} key={index} />
                        ))}
                    </div>
                </div>
            )}

            {showRenderConfig ? (
                <div className='editor-sidebar-scene-container'>
                    <EffectsControls />
                    <EnvironmentControls />
                </div>
            ) : (
                activeSidebarTab === 'Scene' ? (
                    <CanvasSidebarScene />
                ) : (
                    <CanvasSidebarModifiers />
                )
            )}
        </div>

        <div className='editor-sidebar-bottom-container'>
          <div className='editor-sidebar-user-avatar-wrapper'>
            <SidebarUserAvatar
              avatarrounded={false}
              hideEmail={true}
              hideUsername={collapsed}
            />
          </div>
        </div>
      </EditorWidget>
    </motion.aside>
  );
};

export default EditorSidebar;
