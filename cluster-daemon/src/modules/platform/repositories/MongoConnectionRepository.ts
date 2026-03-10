import mongoose from 'mongoose';

export const connectMongo = async (uri: string): Promise<void> => {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    await mongoose.connect(uri);
};

export const disconnectMongo = async (): Promise<void> => {
    if (mongoose.connection.readyState === 0) {
        return;
    }

    await mongoose.disconnect();
};
