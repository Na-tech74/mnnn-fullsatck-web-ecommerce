import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";

import * as bcrypt from 'bcrypt';

import { Model, Types } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { CreateUserDto } from "./dto/create-user.dto";


@Injectable()
export class UserService {

    constructor(@InjectModel(User.name)
    private readonly userModel: Model<UserDocument>) { }

    // CREATE
    async createUser(createUserDto: CreateUserDto) {
        const { password, ...userData } = createUserDto;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await this.userModel.create({
            ...userData,
            password: hashedPassword
        });

        return {
            _id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }
    };

    // find all
    async findAll() {
        return this.userModel.find().exec();
    };

    // Read one
    async findOne(_id: string) {

        if (!Types.ObjectId.isValid(_id)) {
            throw new BadRequestException('Invalid user ID');
        };

        const user = await this.userModel.findById(_id).exec();
        if (!user) {
            throw new NotFoundException('User not found');
        };

        return user;
    };

    //update
};