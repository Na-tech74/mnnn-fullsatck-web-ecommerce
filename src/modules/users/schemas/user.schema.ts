import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })

//Data-defining class
export class User {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true, select: false })
    password: string;

    createdAt: Date;
    updatedAt: Date;
}

//Mongoose Document Type
export type UserDocument = HydratedDocument<User>;

//Defining a schema with Mongoose
export const UserSchema = SchemaFactory.createForClass(User);