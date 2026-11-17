import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { DUPLICATE_KEY_CODE } from '../../common/constants/app.constant';
import { ERROR_MESSAGES } from '../../common/constants/messages.constant';
import { hashPassword } from '../../common/utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { IUserResponse } from './interfaces/user.interface';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  public constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private handleDuplicateKey(error: any): never {
    if (error?.code === DUPLICATE_KEY_CODE) {
      throw new ConflictException(ERROR_MESSAGES.EMAIL_EXISTS);
    }
    throw error;
  }

  private ensureFound(user: UserDocument | null): UserDocument {
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    return user;
  }

  public toResponse(user: UserDocument): IUserResponse {
    return {
      _id: String(user._id),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  public async createUser(dto: CreateUserDto): Promise<UserDocument> {
    const password = await hashPassword(dto.password);

    try {
      return await this.userModel.create({
        name: dto.name,
        email: dto.email,
        password,
      });
    } catch (error) {
      this.handleDuplicateKey(error);
    }
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  public async findById(_id: string): Promise<UserDocument | null> {
    return this.userModel.findById(_id).exec();
  }

  public async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  public async findOne(_id: string): Promise<UserDocument> {
    const user = await this.findById(_id);
    return this.ensureFound(user);
  }

  public async updateUser(
    _id: string,
    dto: UpdateUserDto,
  ): Promise<UserDocument> {
    const updateData: UpdateUserDto = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }
    if (dto.password !== undefined) {
      updateData.password = await hashPassword(dto.password);
    }

    try {
      const user = await this.userModel
        .findByIdAndUpdate(_id, updateData, {
          new: true,
          runValidators: true,
        })
        .exec();

      return this.ensureFound(user);
    } catch (error) {
      this.handleDuplicateKey(error);
    }
  }

  public async deleteUser(_id: string): Promise<void> {
    const user = await this.userModel.findByIdAndDelete(_id).exec();
    this.ensureFound(user);
  }
}
