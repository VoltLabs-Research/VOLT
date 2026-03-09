import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { inject, injectable } from 'tsyringe';

import type { ITrajectoryReader } from '@modules/trajectory/domain/port/trajectory/ITrajectoryReader';
import type { FrameMetadata, ParseOptions, ParseResult } from '@modules/trajectory/domain/contracts/trajectory';
import type TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

@injectable()
export default class TrajectoryReader implements ITrajectoryReader {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService)
        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService
    ) {}

    async read(
        filePath: string,
        options?: ParseOptions,
        teamClusterId?: string,
        trajectoryId?: string,
        timestep?: string | number
    ): Promise<ParseResult> {
        if (!teamClusterId || !trajectoryId || timestep === undefined) {
            throw new ApplicationError(
                ErrorCodes.TRAJECTORY_DATA_PARSE_FAILED,
                'Trajectory reading requires a team cluster. No local native modules available.',
                501
            );
        }

        const metadata = await this.trajectoryNativeDaemonService.getTrajectoryMetadata({
            teamClusterId,
            trajectoryId,
            timestep,
            objectKey: this.getDumpObjectKey(trajectoryId, timestep)
        }) as FrameMetadata;
        const atomsPage = await this.trajectoryNativeDaemonService.getAtomsPage({
            teamClusterId,
            trajectoryId,
            timestep,
            objectKey: this.getDumpObjectKey(trajectoryId, timestep),
            page: 1,
            limit: metadata.natoms
        });

        const positions = new Float32Array(atomsPage.atoms.length * 3);
        const types = new Uint16Array(atomsPage.atoms.length);
        let ids: Uint32Array | undefined;

        if (options?.includeIds) {
            ids = new Uint32Array(atomsPage.atoms.length);
        }

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let index = 0; index < atomsPage.atoms.length; index++) {
            const atom = atomsPage.atoms[index];
            positions[index * 3] = atom.x;
            positions[index * 3 + 1] = atom.y;
            positions[index * 3 + 2] = atom.z;
            types[index] = atom.type;
            if (ids) {
                ids[index] = atom.id;
            }

            if (atom.x < minX) minX = atom.x;
            if (atom.y < minY) minY = atom.y;
            if (atom.z < minZ) minZ = atom.z;
            if (atom.x > maxX) maxX = atom.x;
            if (atom.y > maxY) maxY = atom.y;
            if (atom.z > maxZ) maxZ = atom.z;
        }

        return {
            metadata,
            positions,
            types,
            ids,
            properties: {},
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ]
        };
    }

    async readMetadata(
        filePath: string,
        teamClusterId?: string,
        trajectoryId?: string,
        timestep?: string | number
    ): Promise<FrameMetadata> {
        if (!teamClusterId || !trajectoryId || timestep === undefined) {
            throw new ApplicationError(
                ErrorCodes.TRAJECTORY_DATA_PARSE_FAILED,
                'Trajectory metadata reading requires a team cluster. No local native modules available.',
                501
            );
        }

        return this.trajectoryNativeDaemonService.getTrajectoryMetadata({
            teamClusterId,
            trajectoryId,
            timestep,
            objectKey: this.getDumpObjectKey(trajectoryId, timestep)
        });
    }

    private getDumpObjectKey(trajectoryId: string, timestep: string | number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }
};
