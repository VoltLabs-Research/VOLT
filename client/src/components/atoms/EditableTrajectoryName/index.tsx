import EditableTag from '@/components/atoms/EditableTag';
import useTrajectoryStore from '@/stores/trajectories';
import useAuthStore from '@/stores/authentication';

const EditableTrajectoryName = ({ trajectory, className }) => {
    const updateTrajectoryById = useTrajectoryStore((state) => state.updateTrajectoryById);
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = !!user;

    const handleNameUpdate = async (newName: string) => {
        if (!isAuthenticated) return; // No permitir editar si no hay usuario autenticado
        try {
            await updateTrajectoryById(trajectory._id, { name: newName });
        } catch (error: any) {
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

    return (
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
            // Si no está autenticado, mostrar como texto normal
            <h3 className={className}>{trajectory?.name}</h3>
        )
    );
};

export default EditableTrajectoryName;