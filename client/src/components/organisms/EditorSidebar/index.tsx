import React, { useEffect } from 'react';
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
import './EditorSidebar.css';

const EditorSidebar = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const activeSidebarTab = useConfigurationStore((state) => state.activeSidebarTab);
    const setActiveSidebarTag = useConfigurationStore((state) => state.setActiveSidebarTag);
    const setActiveSidebarModifier = useConfigurationStore((state) => state.setActiveSceneObject)

    useEffect(() => {
        return () => {
            setActiveSidebarTag('Scene');
            setActiveSidebarModifier('trajectory');
        };
    }, []);

    return (
        <EditorWidget className='editor-sidebar-container' draggable={false}>
            <div className='editor-sidebar-top-container'>
                <div className='editor-sidebar-header-container'>
                    <div className='editor-sidebar-trajectory-info-container'>
                        <div className='editor-sidebar-trajectory-info-header-container'>
                            <div className='editor-sidebar-trajectory-drop-container'>
                                <EditableTrajectoryName
                                    trajectory={trajectory}
                                    className='editor-sidebar-trajectory-name' />
                                <i className='editor-sidebar-trajectory-drop-icon-container'>
                                    <MdKeyboardArrowDown />
                                </i>
                            </div>

                            <i className='editor-sidebar-panel-icon-container'>
                                <LuPanelRight />
                            </i>
                        </div>
                        <p className='editor-sidebar-header-team-name'>{trajectory?.team?.name}</p>
                    </div>
                </div>

                <div className='editor-sidebar-options-wrapper-container'>
                    <div className='editor-sidebar-options-container'>
                        {['Scene', 'Modifiers'].map((option, index) => (
                            <CanvasSidebarTab option={option} key={index} />
                        ))}
                    </div>
                </div>

                {activeSidebarTab === 'Scene' ? (
                    <CanvasSidebarScene />
                ) : (
                    <CanvasSidebarModifiers />
                )}

            </div>

            <div className='editor-sidebar-bottom-container'>
                <div className='editor-sidebar-user-avatar-wrapper'>
                    <SidebarUserAvatar />
                </div>
            </div>
        </EditorWidget>

    );
};

export default EditorSidebar;