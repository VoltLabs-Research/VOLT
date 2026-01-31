import { useEffect, useCallback } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import { Trajectory } from '@/modules/trajectory/domain/entities';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useGetTrajectories from '../../../hooks/trajectory/use-get-trajectories';
import useDeleteTrajectory from '../../../hooks/trajectory/use-delete-trajectory';
import TrajectoryListItem from '../../atoms/TrajectoryListItem';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './TrajectoryList.css';

interface TrajectoryListProps{
    onFileSelect: (trajectory: Trajectory) => void;
    renderItem?: (
        trajectory: Trajectory, 
        isSelected: boolean, 
        onSelect: () => void, 
        onDelete: (e: React.MouseEvent) => void
    ) => React.ReactNode;
};

const TrajectoryList = ({ onFileSelect, renderItem }: TrajectoryListProps) => {
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isLoading = useTrajectoryStore((state) => state.isLoadingList);
    const selectedTrajectoryId = useTrajectoryStore((state) => state.trajectory?._id);

    const getTrajectories = useGetTrajectories();
    const deleteTrajectory = useDeleteTrajectory();

    const fetchTrajectories = async (): Promise<void> => {
        if(trajectories.length) return;
        await getTrajectories();
    };

    useEffect(() => {
        fetchTrajectories();
    }, []);

    const handleDelete = useCallback(async (trajectoryId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try{
            await deleteTrajectory(trajectoryId);
        }catch(err){
            console.error('Error deleting trajectory:', err);
        }
    }, [deleteTrajectory]);

    const handleSelect = useCallback((trajectory: Trajectory) => {
        onFileSelect(trajectory);
    }, [onFileSelect]);

    return (
        <Container className='d-flex column overflow-hidden file-list-container p-fixed'>
            <Container className='d-flex items-center content-between p-075'>
                <Title className='font-size-3 font-weight-5'>
                    Uploaded Trajectories ({trajectories?.length || 0})
                </Title>
                <IoIosArrowDown className='font-size-3 color-muted' />
            </Container>

            <Container className='d-flex w-max column gap-05 y-scroll file-list-body'>
                {isLoading ? (
                    <Container className='d-flex content-center items-center h-100px'>
                        <Paragraph className='color-secondary font-size-2'>Loading...</Paragraph>
                    </Container>
                ) : (
                    trajectories?.map((trajectory) => {
                        const isSelected = selectedTrajectoryId === trajectory._id;
                        
                        if(renderItem){
                            return renderItem(
                                trajectory,
                                isSelected,
                                () => handleSelect(trajectory),
                                (e) => handleDelete(trajectory._id, e)
                            );
                        }

                        return (
                            <TrajectoryListItem
                                key={trajectory._id}
                                trajectory={trajectory}
                                isSelected={isSelected}
                                onSelect={() => handleSelect(trajectory)}
                                onDelete={(e) => handleDelete(trajectory._id, e)}
                            />
                        );
                    })
                )}
            </Container>
        </Container>
    );
};

export default TrajectoryList;
