import React, { useState } from 'react';
import { IoClose, IoAdd, IoTrash } from 'react-icons/io5';
import { api } from '@/api';
import useToast from '@/hooks/ui/use-toast';
import './CreateContainerModal.css';

interface CreateContainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateContainerModal: React.FC<CreateContainerModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [image, setImage] = useState('');
    const [teamId, setTeamId] = useState('');
    const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
    const [ports, setPorts] = useState<{ private: number; public: number }[]>([]);
    const [loading, setLoading] = useState(false);

    const { showSuccess, showError } = useToast();

    // Get user's teams (mock/simplified for now, ideally fetch from store or API)
    // Assuming the user object has teams or we fetch them. 
    // For this implementation, we'll fetch teams on mount if needed, 
    // but let's assume we can get them from the auth store or a hook.
    // Since we don't have a global teams store ready in the context provided,
    // we'll fetch them when the modal opens.
    const [teams, setTeams] = useState<{ _id: string; name: string }[]>([]);

    React.useEffect(() => {
        if (isOpen) {
            api.get('/teams').then(res => {
                const teamsList = res.data.data || [];
                setTeams(teamsList);
                if (teamsList.length > 0) {
                    setTeamId(teamsList[0]._id);
                }
            });
        }
    }, [isOpen]);

    const handleAddEnv = () => {
        setEnvVars([...envVars, { key: '', value: '' }]);
    };

    const handleRemoveEnv = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index));
    };

    const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
        const newEnv = [...envVars];
        newEnv[index][field] = value;
        setEnvVars(newEnv);
    };

    const handleAddPort = () => {
        setPorts([...ports, { private: 80, public: 8080 }]);
    };

    const handleRemovePort = (index: number) => {
        setPorts(ports.filter((_, i) => i !== index));
    };

    const handlePortChange = (index: number, field: 'private' | 'public', value: string) => {
        const newPorts = [...ports];
        newPorts[index][field] = parseInt(value) || 0;
        setPorts(newPorts);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.post('/containers', {
                name,
                image,
                teamId,
                env: envVars.filter(e => e.key && e.value),
                ports: ports
            });

            showSuccess('Container created successfully');
            onSuccess();
            onClose();
            // Reset form
            setName('');
            setImage('');
            setEnvVars([]);
            setPorts([]);
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to create container');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className='modal-overlay'>
            <div className='create-container-modal'>
                <div className='modal-header'>
                    <h2>Create Container</h2>
                    <button onClick={onClose} className='close-btn'>
                        <IoClose size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className='modal-body'>
                    <div className='form-group'>
                        <label>Container Name</label>
                        <input
                            type='text'
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder='e.g., my-web-server'
                            required
                        />
                    </div>

                    <div className='form-group'>
                        <label>Docker Image</label>
                        <input
                            type='text'
                            value={image}
                            onChange={e => setImage(e.target.value)}
                            placeholder='e.g., nginx:latest'
                            required
                        />
                    </div>

                    <div className='form-group'>
                        <label>Team</label>
                        <select
                            value={teamId}
                            onChange={e => setTeamId(e.target.value)}
                            className='team-select'
                        >
                            {teams.map(team => (
                                <option key={team._id} value={team._id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className='form-section'>
                        <div className='section-header'>
                            <label>Environment Variables</label>
                            <button type='button' onClick={handleAddEnv} className='add-btn-small'>
                                <IoAdd /> Add
                            </button>
                        </div>
                        {envVars.map((env, i) => (
                            <div key={i} className='env-row'>
                                <input
                                    placeholder='KEY'
                                    value={env.key}
                                    onChange={e => handleEnvChange(i, 'key', e.target.value)}
                                />
                                <input
                                    placeholder='VALUE'
                                    value={env.value}
                                    onChange={e => handleEnvChange(i, 'value', e.target.value)}
                                />
                                <button type='button' onClick={() => handleRemoveEnv(i)} className='remove-btn'>
                                    <IoTrash />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className='form-section'>
                        <div className='section-header'>
                            <label>Port Mapping</label>
                            <button type='button' onClick={handleAddPort} className='add-btn-small'>
                                <IoAdd /> Add
                            </button>
                        </div>
                        {ports.map((port, i) => (
                            <div key={i} className='port-row'>
                                <div className='port-input'>
                                    <span>Container</span>
                                    <input
                                        type='number'
                                        value={port.private}
                                        onChange={e => handlePortChange(i, 'private', e.target.value)}
                                    />
                                </div>
                                <div className='port-arrow'>→</div>
                                <div className='port-input'>
                                    <span>Host</span>
                                    <input
                                        type='number'
                                        value={port.public}
                                        onChange={e => handlePortChange(i, 'public', e.target.value)}
                                    />
                                </div>
                                <button type='button' onClick={() => handleRemovePort(i)} className='remove-btn'>
                                    <IoTrash />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className='modal-footer'>
                        <button type='button' onClick={onClose} className='cancel-btn'>Cancel</button>
                        <button type='submit' disabled={loading} className='submit-btn'>
                            {loading ? 'Creating...' : 'Create Container'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateContainerModal;
