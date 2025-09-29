import EditorWidget from '@/components/organisms/EditorWidget';
import { useNavigate } from 'react-router';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { LuLayoutDashboard } from "react-icons/lu";
import { GrHomeRounded } from "react-icons/gr";
import { MdOutlineLightMode } from "react-icons/md";
import { TbAugmentedReality2 } from "react-icons/tb";
import { GoDownload } from "react-icons/go";
import { CiShare1 } from "react-icons/ci";
import './SceneTopCenteredOptions.css';

const SceneTopCenteredOptions = () => {
    const navigate = useNavigate();

    return (
        <EditorWidget className='editor-top-centered-options-container' draggable={false}>
            {[
                [GrHomeRounded, () => navigate('/dashboard')],
                [MdOutlineLightMode, () => {}],
                [LuLayoutDashboard, () => {}]
            ].map(([ Icon, callback ], index) => (
                <i 
                    onClick={callback}
                    className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')} 
                    key={index}
                >
                    <Icon />
                </i>
            ))}

            <div className='editor-scene-zoom-container'>
                <span className='editor-scene-zoom'>100%</span>
                <i className='editor-scene-zoom-icon-container'>
                    <MdKeyboardArrowDown />
                </i>
            </div>

            {[
                [TbAugmentedReality2, () => {}],
                [GoDownload, () => {}],
                [CiShare1, () => {}]
            ].map(([ Icon, callback ], index) => (
                <i className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')} key={index}>
                    <Icon />
                </i>
            ))}
        </EditorWidget>
    );
};

export default SceneTopCenteredOptions;