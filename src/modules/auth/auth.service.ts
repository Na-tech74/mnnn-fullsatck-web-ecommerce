import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../../common/constants/messages.constant';
import {
  comparePassword,
  hashPassword,
} from '../../common/utils/password.util';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import {
  IAuthResult,
  IAuthTokens,
  IJwtPayload,
  IMessageResponse,
} from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  public constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private getRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private async generateTokens(user: UserDocument): Promise<IAuthTokens> {
    const payload: IJwtPayload = {
      _id: String(user._id),
      email: user.email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.getRefreshSecret(),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      }),
    ]);

    const hashedRefreshToken = await hashPassword(refreshToken);
    await this.userModel
      .findByIdAndUpdate(user._id, { refreshToken: hashedRefreshToken })
      .exec();

    return { accessToken, refreshToken };
  }

  private async validateUser(dto: LoginDto): Promise<UserDocument> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const isMatch = await comparePassword(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    return user;
  }

  public async register(dto: RegisterDto): Promise<IAuthResult> {
    const user = await this.userService.createUser(dto);
    const tokens = await this.generateTokens(user);
    return { user: this.userService.toResponse(user), ...tokens };
  }

  public async login(dto: LoginDto): Promise<IAuthResult> {
    const user = await this.validateUser(dto);
    const tokens = await this.generateTokens(user);
    return { user: this.userService.toResponse(user), ...tokens };
  }

  public async refreshTokens(dto: RefreshTokenDto): Promise<IAuthTokens> {
    let payload: IJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<IJwtPayload>(
        dto.refreshToken,
        { secret: this.getRefreshSecret() },
      );
    } catch {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const user = await this.userModel
      .findById(payload._id)
      .select('+refreshToken')
      .exec();

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException(ERROR_MESSAGES.ACCESS_DENIED);
    }

    const isMatch = await comparePassword(dto.refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException(ERROR_MESSAGES.ACCESS_DENIED);
    }

    return this.generateTokens(user);
  }

  public async logout(_id: string): Promise<IMessageResponse> {
    await this.userModel.findByIdAndUpdate(_id, { refreshToken: null }).exec();
    return { message: SUCCESS_MESSAGES.LOGGED_OUT };
  }
}
