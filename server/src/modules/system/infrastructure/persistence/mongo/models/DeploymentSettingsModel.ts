import { DeploymentSettingsProps } from '@modules/system/domain/entities/DeploymentSettings';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema, Model, Document } from 'mongoose';

type DeploymentSettingsRelations = 'defaultTeam';

export interface DeploymentSettingsDocument
    extends Persistable<DeploymentSettingsProps, DeploymentSettingsRelations>, Document {
    // Persistence-only singleton guard (not part of the domain props contract).
    key: string;
}

const DeploymentSettingsSchema: Schema<DeploymentSettingsDocument> = new Schema({
    key: {
        type: String,
        default: 'singleton',
        unique: true,
        immutable: true
    },
    defaultTeam: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        default: null
    },
    autoJoinNewMembers: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const DeploymentSettingsModel: Model<DeploymentSettingsDocument> = mongoose.model<DeploymentSettingsDocument>(
    'DeploymentSettings',
    DeploymentSettingsSchema
);

export default DeploymentSettingsModel;
