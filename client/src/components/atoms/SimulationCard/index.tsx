/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { useNavigate } from 'react-router-dom';
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import { PiAtomThin } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { CiShare1 } from "react-icons/ci";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";
import SimpExampleCover from '@/assets/images/simulation-example-cover.png';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import EditableTag from '@/components/atoms/EditableTag';
import useTrajectoryStore from '@/stores/trajectories';
import ActionBasedFloatingContainer from '@/components/atoms/ActionBasedFloatingContainer';
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