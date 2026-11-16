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

};

//Defining a schema with Mongoose
export const UserSchema = SchemaFactory.createForClass(User);

//remove password from the returned data
UserSchema.set('toJSON', {
    transform: (_doc, ret: Record<string, any>) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    },
});