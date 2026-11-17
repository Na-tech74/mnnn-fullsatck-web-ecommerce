import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

//Mongoose Document Type
export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })

//Data-defining class
export class User {

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true, select: false, })
    password: string;

    @Prop({ type: String, default: null, select: false })
    refreshToken: string | null;
};

//Defining a schema with Mongoose
export const UserSchema = SchemaFactory.createForClass(User);

//remove password from the returned data
UserSchema.set('toJSON', {
    transform: (_doc, ret: Record<string, any>) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        const { _id, name, email, createdAt, updatedAt, ...rest } = ret;
        return { _id, name, email, createdAt, updatedAt, ...rest };
    },
});