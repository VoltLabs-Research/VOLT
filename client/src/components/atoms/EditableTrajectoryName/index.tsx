import EditableTag from '@/components/atoms/EditableTag';
import useTrajectoryStore from '@/stores/trajectories';

const EditableTrajectoryName = ({ trajectory, className }) => {
    const updateTrajectoryById = useTrajectoryStore((state) => state.updateTrajectoryById);

    const handleNameUpdate = async (newName: string) => {
        await updateTrajectoryById(trajectory._id, { name: newName });
    };

    return (
        <EditableTag
            as='h3'
            className={className}
            onSave={handleNameUpdate}
            title='Double-clic to edit name'
        >
            {trajectory?.name}
        </EditableTag>
    );
};

export default EditableTrajectoryName;