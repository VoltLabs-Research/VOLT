import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import { LuPanelRight } from "react-icons/lu";
import { MdKeyboardArrowDown } from 'react-icons/md';
import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import EditableTrajectoryName from '@/components/atoms/EditableTrajectoryName';
import CanvasSidebarTab from '@/components/atoms/CanvasSidebarTab';
import CanvasSidebarScene from '@/components/molecules/CanvasSidebarScene';
import CanvasSidebarModifiers from '@/components/molecules/CanvasSidebarModifiers';
import useConfigurationStore from '@/stores/editor/configuration';
import useAuthStore from '@/stores/authentication';
import './EditorSidebar.css';

const EditorSidebar = () => {
  const trajectory = useTrajectoryStore((state) => state.trajectory);
  const activeSidebarTab = useConfigurationStore((state) => state.activeSidebarTab);
  const setActiveSidebarTag = useConfigurationStore((state) => state.setActiveSidebarTag);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    return () => {
      setActiveSidebarTag('Scene');
      // setActiveSidebarModifier('trajectory');
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
        {/* TOP */}
        <div className='editor-sidebar-top-container'>
          <div className='editor-sidebar-header-container'>
            <div className='editor-sidebar-trajectory-info-container'>
              <div className='editor-sidebar-trajectory-info-header-container'>
                {/* Bloque título+chevron -> se oculta en colapsado via CSS */}
                <div
                  className='editor-sidebar-trajectory-drop-container'
                  data-collapsible="true"
                >
                  <EditableTrajectoryName
                    trajectory={trajectory}
                    className='editor-sidebar-trajectory-name'
                  />
                  <i className='editor-sidebar-trajectory-drop-icon-container'>
                    <MdKeyboardArrowDown />
                  </i>
                </div>

                {/* Botón de contraer/expandir (siempre visible) */}
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

              {/* Team name -> se oculta en colapsado via CSS */}
              <p className='editor-sidebar-header-team-name' data-collapsible="true">
                {trajectory?.team?.name}
              </p>
            </div>
          </div>

          {/* Tabs: se ocultan completos al colapsar */}
          <div className='editor-sidebar-options-wrapper-container' data-collapsible="true">
            <div className='editor-sidebar-options-container'>
              {['Scene', 'Modifiers'].map((option, index) => (
                <CanvasSidebarTab option={option} key={index} />
              ))}
            </div>
          </div>

          {/* Contenido según tab: SIEMPRE renderizado.
              En colapsado, CSS fuerza "icon-only" (oculta títulos). */}
          {activeSidebarTab === 'Scene' ? (
            <CanvasSidebarScene />
          ) : (
            <CanvasSidebarModifiers />
          )}
        </div>

        {/* BOTTOM: avatar siempre renderizado; en colapsado se muestra solo el icono */}
        <div className='editor-sidebar-bottom-container'>
          <div className='editor-sidebar-user-avatar-wrapper'>
            <SidebarUserAvatar
              avatarrounded={true}
              hideEmail={true}
              hideUsername={true}  /* forzamos ocultar texto */
            />
          </div>
        </div>
      </EditorWidget>
    </motion.aside>
  );
};

export default EditorSidebar;
