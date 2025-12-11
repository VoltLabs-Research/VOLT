import Sidebar from '@/components/organisms/common/Sidebar';
import useTrajectoryStore from '@/stores/trajectories';
import useConfigurationStore from '@/stores/editor/configuration';
import CanvasSidebarModifiers from '@/components/molecules/scene/CanvasSidebarModifiers';
import CanvasSidebarScene from '@/components/molecules/scene/CanvasSidebarScene';
import SidebarUserAvatar from '@/components/atoms/auth/SidebarUserAvatar';
import useEditorUIStore from '@/stores/ui/editor';
import EditableTrajectoryName from '@/components/atoms/trajectory/EditableTrajectoryName';
import { BsArrowLeft } from 'react-icons/bs';
import { MdKeyboardArrowDown } from 'react-icons/md';
import LightsControls from '@/components/molecules/scene/LightsControls';
import EffectsControls from '@/components/molecules/scene/EffectsControls';
import PerformanceSettingsControls from '@/components/molecules/scene/PerfomanceSettingsControls';
import EnvironmentControls from '@/components/molecules/scene/EnvironmentControls';
import CameraSettingsControls from '@/components/molecules/scene/CameraSettingsControls';
import RendererSettingsControls from '@/components/molecules/scene/RendererSettingsControls';
import CanvasGridControls from '@/components/molecules/scene/CanvasGridControls';
import OrbitControls from '@/components/molecules/scene/OrbitControls';
import './EditorSidebar.css';

const RenderConfig = () => (
    <div className='editor-render-options-container'>
        <LightsControls />
        <EffectsControls />
        <PerformanceSettingsControls />
        <EnvironmentControls />
        <CameraSettingsControls />
        <OrbitControls />
        <RendererSettingsControls />
        <CanvasGridControls />
    </div>
);

const EditorSidebar = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const activeSidebarTab = useConfigurationStore((state) => state.activeSidebarTab);
    const showRenderConfig = useEditorUIStore((state) => state.showRenderConfig);
    const setShowRenderConfig = useEditorUIStore((state) => state.setShowRenderConfig);

    const SCENE_TAGS = [
        {
            id: "Scene",
            name: "Scene",
            Component: CanvasSidebarScene,
            props: { trajectory }
        },
        {
            id: "Modifiers",
            name: "Modifiers",
            Component: CanvasSidebarModifiers,
            props: {}
        }
    ];

    return (
        <Sidebar 
            tags={SCENE_TAGS} 
            activeTag={activeSidebarTab} 
            overrideContent={showRenderConfig ? <RenderConfig /> : null}
            showCollapseButton
        >
            <Sidebar.Header>
                <div className='editor-sidebar-trajectory-info-container'>
                    <div className='editor-sidebar-trajectory-info-header-container'>
                        <div
                            className='editor-sidebar-trajectory-drop-container'
                            data-collapsible="true"
                        >
                            {showRenderConfig ? (
                                <div className='editor-sidebar-render-title-container'>
                                    <i className='editor-sidebar-render-title-icon-container' onClick={() => setShowRenderConfig(false)}>
                                        <BsArrowLeft size={30} />
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
                    </div>
                </div>
                {!showRenderConfig && trajectory?.team?.name && (
                    <p className="editor-sidebar-header-team-name">
                        {trajectory.team.name}
                    </p>
                )}
            </Sidebar.Header>

            <Sidebar.Bottom>
                <div className='editor-sidebar-user-avatar-wrapper'>
                    <SidebarUserAvatar
                        avatarrounded={false}
                        hideEmail={true}
                    />
                </div>
            </Sidebar.Bottom>
        </Sidebar>
    );
};

export default EditorSidebar;