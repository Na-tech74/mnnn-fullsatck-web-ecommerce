import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";

import * as bcrypt from 'bcrypt';

import { Model, Types } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";

import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const SALT_ROUNDS = 10;
const DUPLICATE_KEY_CODE = 11000;

@Injectable()
export class UserService {

    constructor(@InjectModel(User.name)
    private readonly userModel: Model<UserDocument>) { };

    // ---------- helpers ----------

    /*
     handleDuplicateKey: catches the 11000 error and converts it into a ConflictException (409).
     Otherwise, the error propagates outward, and the client receives a 500 response.
     */
    private handleDuplicateKey(error: any): never {
        if (error?.code === DUPLICATE_KEY_CODE) {
            throw new ConflictException('Email already exists');
        };
        throw error;
    };

    private ensureFound(user: UserDocument | null): UserDocument {
        if (!user) {
            throw new NotFoundException('User not found')
        };
        return user;
    }

    //--------------CRUD------------------

    // Create user: used in auth.service to implement the register method.
    async createUser(dto: CreateUserDto): Promise<UserDocument> {
        const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
        try {
            return await this.userModel.create({ ...dto, password })
        } catch (error) {
            this.handleDuplicateKey(error);
        };
    };

    // find by email with password : used in auth.service to implement the login method.
    async findByEmailWithPassword(email: string): Promise<UserDocument> {
        const user = await this.userModel.findOne({ email })
            .select('+password')
            .exec();
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        };
        return user;
    };

    async findAll(): Promise<UserDocument[]> {
        return this.userModel.find().exec();
    };

    async findOne(_id: string): Promise<UserDocument> {
        const user = await this.userModel.findById(_id).exec()
        return this.ensureFound(user);
    };

    async updateUser(_id: string, dto: UpdateUserDto): Promise<UserDocument> {

        const updateData = { ...dto };
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS);
        };

        try {
            const user = await this.userModel.findByIdAndUpdate(_id, updateData, {
                new: true,
                runValidators: true,
            }).exec();

            return this.ensureFound(user)

        } catch (error) {
            this.handleDuplicateKey(error);
        };
    };

    async deleteUser(_id: string): Promise<void> {
        const user = await this.userModel.findByIdAndDelete(_id).exec();
        this.ensureFound(user);
    };

};