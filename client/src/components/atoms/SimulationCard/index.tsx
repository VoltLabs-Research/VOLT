import { useNavigate } from 'react-router-dom';
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import { PiAtomThin } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { CiShare1 } from "react-icons/ci";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";
import SimpExampleCover from '../../../assets/images/simulation-example-cover.png';
import formatTimeAgo from '../../../utilities/formatTimeAgo';
import EditableTag from '../EditableTag';
import useTrajectoryStore from '../../../stores/trajectories';
import ActionBasedFloatingContainer from '../ActionBasedFloatingContainer';
import './SimulationCard.css';

const SimulationCard = ({ trajectory }) => {
    const navigate = useNavigate();
    const updateTrajectoryById = useTrajectoryStore((state) => state.updateTrajectoryById);
    const deleteTrajectoryById = useTrajectoryStore((state) => state.deleteTrajectoryById);
    
    const loadTrajectoryOnCanvas = () => {
        navigate(`/canvas/${trajectory._id}/`);
    };

    const handleNameUpdate = async (newName: string) => {
        await updateTrajectoryById(trajectory._id, { name: newName });
    };

    const handleDelete = async () => {
        await deleteTrajectoryById(trajectory._id);
        navigate('/dashboard');
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
                <ActionBasedFloatingContainer
                    options={[
                        ['View Scene', HiOutlineViewfinderCircle, loadTrajectoryOnCanvas],
                        ['Share with Team', CiShare1, () => {}],
                        ['Delete', RxTrash, handleDelete]
                    ]}
                >
                    <i className='simulation-options-icon-container'>
                        <PiDotsThreeVerticalBold />
                    </i>
                </ActionBasedFloatingContainer>
            </figcaption>
        </figure>
    );
};

export default SimulationCard;