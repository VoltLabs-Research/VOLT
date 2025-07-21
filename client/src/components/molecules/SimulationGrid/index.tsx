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

import SimulationCard from '@/components/atoms/SimulationCard';
import SimulationSkeletonCard from '@/components/atoms/SimulationSkeletonCard';
import useTrajectoryStore from '@/stores/trajectories';
import useTeamStore from '@/stores/team';
import useAnimationPresence from '@/hooks/useAnimationPresence';
import './SimulationGrid.css';

const SimulationGrid = () => {
    const [parent] = useAnimationPresence();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const isLoadingTeams = useTeamStore((state) => state.isLoading);
    const isUploading = useTrajectoryStore((state) => state.isUploading);

    return (
        <div className='trajectories-container' ref={parent}>
            {(isLoading || isLoadingTeams) && (
                <SimulationSkeletonCard n={8} />
            )}

            
            {trajectories.map((trajectory) => (
                <SimulationCard key={trajectory._id} trajectory={trajectory} />
            ))}

            {(isUploading) && (
                <SimulationSkeletonCard n={1} />
            )}
        </div>
    );
};

export default SimulationGrid;