import { useNavigate } from 'react-router-dom';
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import { PiAtomThin } from 'react-icons/pi';
import SimpExampleCover from '../../../assets/images/simulation-example-cover.png';
import formatTimeAgo from '../../../utilities/formatTimeAgo';
import EditableTag from '../EditableTag';
import useTrajectoryStore from '../../../stores/trajectories';
import './SimulationCard.css';

const SimulationCard = ({ trajectory }) => {
    const navigate = useNavigate();
    const updateTrajectoryById = useTrajectoryStore((state) => state.updateTrajectoryById);
    
    const loadTrajectoryOnCanvas = () => {
        navigate(`/canvas/${trajectory._id}/`);
    };

    const handleNameUpdate = async (newName: string) => {
        await updateTrajectoryById(trajectory._id, { name: newName });
    };

    return (
        <figure className='simulation-container'>
            <div className='simulation-cover-container' onClick={loadTrajectoryOnCanvas}>
                {true ? (
                    <i className='simulation-cover-icon-container'>
                        <PiAtomThin />
                    </i>
                ) : (
                    <img className='simulation-image' src={SimpExampleCover} />
                )}
            </div>
            <figcaption className='simulation-caption-container'>
                <div className='simulation-caption-left-container'>
                    <EditableTag
                        as='h3'
                        className='simulation-caption-title'
                        onSave={handleNameUpdate}
                        title='Double-click to edit name'
                    >
                        {trajectory.name}
                    </EditableTag>
                    <p className='simulation-last-edited'>Edited {formatTimeAgo(trajectory.updatedAt)}</p>
                </div>
                <i className='simulation-options-icon-container'>
                    <PiDotsThreeVerticalBold />
                </i>
            </figcaption>
        </figure>
    );
};

export default SimulationCard;