import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { IAuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import type { IUserResponse } from './interfaces/user.interface';
import { UserService } from './users.service';

@Controller('users')
export class UserController {
  public constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  public async getProfile(
    @Req() req: IAuthenticatedRequest,
  ): Promise<IUserResponse> {
    const user = await this.userService.findOne(req.user._id);
    return this.userService.toResponse(user);
  }

  @Get()
  @HttpCode(200)
  public async findAll(): Promise<IUserResponse[]> {
    const users = await this.userService.findAll();
    return users.map((user) => this.userService.toResponse(user));
  }

  @Get(':id')
  @HttpCode(200)
  public async findOne(
    @Param('id', ParseObjectIdPipe) _id: string,
  ): Promise<IUserResponse> {
    const user = await this.userService.findOne(_id);
    return this.userService.toResponse(user);
  }

  @Patch(':id')
  @HttpCode(200)
  public async updateUser(
    @Param('id', ParseObjectIdPipe) _id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<IUserResponse> {
    const user = await this.userService.updateUser(_id, dto);
    return this.userService.toResponse(user);
  }

  @Delete(':id')
  @HttpCode(200)
  public async deleteUser(
    @Param('id', ParseObjectIdPipe) _id: string,
  ): Promise<void> {
    return this.userService.deleteUser(_id);
  }
}
