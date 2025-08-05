import { useState } from 'react';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import { LuPanelRight } from "react-icons/lu";
import { TbObjectScan } from "react-icons/tb";
import { PiLineSegmentThin, PiAtomThin, PiTriangleDashedThin } from "react-icons/pi";
import { SiTraefikmesh } from "react-icons/si";
import { IoIosColorFilter } from "react-icons/io";
import { MdKeyboardArrowDown } from 'react-icons/md';
import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import EditableTrajectoryName from '@/components/atoms/EditableTrajectoryName';
import useConfigurationStore from '@/stores/editor/configuration';
import './EditorSidebar.css';

const EditorSidebar = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const setActiveSceneObject = useConfigurationStore((state) => state.setActiveSceneObject);
    const [activeSidebarTab, setActiveSidebarTag] = useState('Scene');

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
                            <div 
                                className={'editor-sidebar-option-container '.concat((option === activeSidebarTab) ? 'selected': '')} 
                                onClick={() => setActiveSidebarTag(option)}
                                key={index}
                            >
                                <h3 className='editor-sidebar-option-title'>{option}</h3>
                            </div>
                        ))}
                    </div>
                </div>

                {activeSidebarTab === 'Scene' ? (
                    <div className='editor-sidebar-scene-container'>
                        <div className='editor-sidebar-scene-options-container'>
                            {[
                                [TbObjectScan, 'Camera 1', 'trajectory'],
                                [PiLineSegmentThin, 'Dislocations', 'dislocations'],
                                [SiTraefikmesh, 'Defect Mesh', 'defect_mesh'],
                                [PiAtomThin, 'Dislocation Core Atoms', 'core_atoms'],
                                [PiTriangleDashedThin, 'Interface Mesh', 'interface_mesh'],
                                [IoIosColorFilter, 'Structure Identification', 'atoms_colored_by_type']
                            ].map(([ Icon, title, sceneType ], index) => (
                                <div 
                                    className='editor-sidebar-scene-option-container' 
                                    onClick={() => setActiveSceneObject(sceneType)}
                                    key={index}
                                >
                                    <i className='editor-sidebar-scene-option-icon-container'>
                                        <Icon />
                                    </i>
                                    <h3 className='editor-sidebar-scene-option-title'>{title}</h3>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className='editor-sidebar-modifiers-container'>

                    </div>
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