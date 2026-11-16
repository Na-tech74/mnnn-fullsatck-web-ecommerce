import { Module } from "@nestjs/common";
import { UserController } from "./users.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./schemas/user.schema";
import { UserService } from "./users.service";

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: User.name, // .name: A built-in property of a JavaScript class that returns the name of the class.
                schema: UserSchema
            },
        ]),
    ],
    providers: [UserService],
    controllers: [UserController]
})
export class UserModule { }