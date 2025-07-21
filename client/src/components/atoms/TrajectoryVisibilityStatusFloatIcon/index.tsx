import { CiLock } from "react-icons/ci";
import EditorWidget from '@/components/organisms/EditorWidget';
import './TrajectoryVisibilityStatusFloatIcon.css';

const TrajectoryVisibilityStatusFloatIcon = () => {
    return (
        <EditorWidget className='trajectory-share-status-container'>
            <i className='trajectory-share-status-icon-container'>
                <CiLock />
            </i>
        </EditorWidget>
    );
};

export default TrajectoryVisibilityStatusFloatIcon;