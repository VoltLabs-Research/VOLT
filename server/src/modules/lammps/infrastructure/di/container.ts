import { LAMMPS_TOKENS } from '@modules/lammps/infrastructure/di/LammpsTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';
import LammpsSocketModule from '@modules/lammps/socket/LammpsSocketModule';
import { LammpsRealtimeService } from '@modules/lammps/services/LammpsRealtimeService';
import { LammpsDaemonRuntimeService } from '@modules/lammps/services/LammpsDaemonRuntimeService';
import { LammpsProgressProjectorService } from '@modules/lammps/services/LammpsProgressProjectorService';
import { LammpsService } from '@modules/lammps/services/LammpsService';

export const registerLammpsDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [LAMMPS_TOKENS.LammpsSocketModule, LammpsSocketModule],
            LammpsRealtimeService,
            LammpsDaemonRuntimeService,
            LammpsProgressProjectorService,
            LammpsService
        ],
        aliases: [
            [SOCKET_TOKENS.SocketModule, LAMMPS_TOKENS.LammpsSocketModule]
        ]
    });
};
