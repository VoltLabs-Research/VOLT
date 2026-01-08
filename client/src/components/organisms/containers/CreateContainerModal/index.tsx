import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoTrash } from 'react-icons/io5';
import teamApi from '@/features/team/api/team';
import containerApi from '@/services/api/container/container';
import useToast from '@/hooks/ui/use-toast';
import './CreateContainerModal.css';
import Title from '@/components/primitives/Title';
import Button from '@/components/primitives/Button';
import Tooltip from '@/components/atoms/common/Tooltip';
import Modal from '@/components/molecules/common/Modal';

interface CreateContainerModalProps {
    isOpen: boolean;
    onSuccess: () => void;
}

const CreateContainerModal: React.FC<CreateContainerModalProps> = ({ isOpen, onSuccess }) => {
    const [name, setName] = useState('');
    const [image, setImage] = useState('');
    const [teamId, setTeamId] = useState('');
    const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
    const [ports, setPorts] = useState<{ private: number; public: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const { showSuccess, showError } = useToast();
    const [teams, setTeams] = useState<{ _id: string; name: string }[]>([]);

    useEffect(() => {
        if (isOpen) {
            teamApi.getAll().then(teamsList => {
                setTeams(teamsList as { _id: string; name: string }[]);
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

    const closeModal = () => {
        (document.getElementById('create-container-modal') as HTMLDialogElement)?.close();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await containerApi.create({
                name,
                image,
                team: teamId,
                environment: Object.fromEntries(envVars.filter(e => e.key && e.value).map(e => [e.key, e.value])),
                ports: Object.fromEntries(ports.map(p => [p.private.toString(), p.public]))
            });

            showSuccess('Container created successfully');
            onSuccess();
            closeModal();
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
        <Modal
            id='create-container-modal'
            title='Create Container'
            width='600px'
            className='create-container-modal w-max'
        >
            <form onSubmit={handleSubmit} className='d-flex column gap-1-25 modal-body y-auto'>
                <div className='d-flex column gap-05 form-group'>
                    <label>Container Name</label>
                    <input
                        type='text'
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder='e.g., my-web-server'
                        required
                    />
                </div>

                <div className='d-flex column gap-05 form-group'>
                    <label>Docker Image</label>
                    <input
                        type='text'
                        value={image}
                        onChange={e => setImage(e.target.value)}
                        placeholder='e.g., nginx:latest'
                        required
                    />
                </div>

                <div className='d-flex column gap-05 form-group'>
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

                <div className='d-flex column gap-075 form-section p-relative gap-1 vh-max p-1-5'>
                    <div className='d-flex content-between items-center section-header'>
                        <label>Environment Variables</label>
                        <Button variant='ghost' intent='neutral' size='sm' leftIcon={<IoAdd />} onClick={handleAddEnv}>
                            Add
                        </Button>
                    </div>
                    {envVars.map((env, i) => (
                        <div key={i} className='d-flex items-center gap-075 env-row'>
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
                            <Tooltip content="Remove Variable" placement="left">
                                <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => handleRemoveEnv(i)}>
                                    <IoTrash />
                                </Button>
                            </Tooltip>
                        </div>
                    ))}
                </div>

                <div className='form-section p-relative gap-1 vh-max p-1-5'>
                    <div className='d-flex content-between items-center section-header'>
                        <label>Port Mapping</label>
                        <Button variant='ghost' intent='neutral' size='sm' leftIcon={<IoAdd />} onClick={handleAddPort}>
                            Add
                        </Button>
                    </div>
                    {ports.map((port, i) => (
                        <div key={i} className='d-flex items-center gap-075 port-row'>
                            <div className='d-flex column gap-025 port-input flex-1'>
                                <span>Container</span>
                                <input
                                    type='number'
                                    value={port.private}
                                    onChange={e => handlePortChange(i, 'private', e.target.value)}
                                />
                            </div>
                            <div className='port-arrow'>→</div>
                            <div className='d-flex column gap-025 port-input flex-1'>
                                <span>Host</span>
                                <input
                                    type='number'
                                    value={port.public}
                                    onChange={e => handlePortChange(i, 'public', e.target.value)}
                                />
                            </div>
                            <Tooltip content="Remove Port" placement="left">
                                <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => handleRemovePort(i)}>
                                    <IoTrash />
                                </Button>
                            </Tooltip>
                        </div>
                    ))}
                </div>

                <div className='d-flex content-end gap-075 modal-footer'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        commandfor='create-container-modal'
                        command='close'
                    >
                        Cancel
                    </Button>
                    <Button variant='solid' intent='brand' type='submit' disabled={loading} isLoading={loading}>
                        Create Container
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateContainerModal;
