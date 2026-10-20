import User from '@modules/auth/models/User';
import type { EntityManager } from 'typeorm';

const resolveManager = (manager?: EntityManager): EntityManager => manager ?? User.getRepository().manager;

export const addTeamToUser = async (userId: string, teamId: string, manager?: EntityManager): Promise<void> => {
    const entityManager = resolveManager(manager);
    const user = await entityManager.findOneBy(User, { id: userId });
    if(!user) return;

    const teams = new Set(user.teams ?? []);
    teams.add(teamId);

    await entityManager.save(Object.assign(user, { teams: [...teams] }));
};

export const removeTeamFromUser = async (userId: string, teamId: string, manager?: EntityManager): Promise<void> => {
    const entityManager = resolveManager(manager);
    const user = await entityManager.findOneBy(User, { id: userId });
    if(!user) return;

    const teams = (user.teams ?? []).filter((currentTeamId) => currentTeamId !== teamId);

    await entityManager.save(Object.assign(user, { teams }));
};
