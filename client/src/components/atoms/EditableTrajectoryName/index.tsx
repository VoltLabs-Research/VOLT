import EditableTag from '@/components/atoms/EditableTag';
import useTrajectoryStore from '@/stores/trajectories';
import useAuthStore from '@/stores/authentication';

const EditableTrajectoryName = ({ trajectory, className }) => {
    const updateTrajectoryById = useTrajectoryStore((state) => state.updateTrajectoryById);
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = !!user;

    const handleNameUpdate = async (newName: string) => {
        if (!isAuthenticated) return; // No permitir editar si no hay usuario autenticado
        await updateTrajectoryById(trajectory._id, { name: newName });
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