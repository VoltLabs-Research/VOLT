import EditableTag from '@/components/atoms/common/EditableTag';
import useTrajectoryStore from '@/stores/trajectories';
import useAuthStore from '@/stores/authentication';
import Title from '@/components/primitives/Title';

const EditableTrajectoryName = ({ trajectory, className }) => {
    const updateTrajectoryById = useTrajectoryStore((state) => state.updateTrajectoryById);
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = !!user;

    const handleNameUpdate = async(newName: string) => {
        if(!isAuthenticated) return; 
        try{
            await updateTrajectoryById(trajectory._id, { name: newName });
        }catch(error: any){
            const errorContext = {
                endpoint: `/trajectories/${trajectory._id}`,
                method: 'PATCH',
                trajectoryId: trajectory._id,
                resourceName: 'trajectory name',
                statusCode: error?.context?.statusCode,
                serverMessage: error?.context?.serverMessage || error?.message,
                timestamp: new Date().toISOString()
            };
            console.error('Failed to update trajectory name:', errorContext);
            throw error;
        }
    };

    return(
        isAuthenticated ? (
            <EditableTag
                as='h3'
                className={className}
                onSave={handleNameUpdate}
                title='Double-clic to edit name'
            >
                {trajectory?.name}
            </EditableTag>
        ) : (
            <Title className={className}>{trajectory?.name}</Title>
        )
    );
};

export default EditableTrajectoryName;
