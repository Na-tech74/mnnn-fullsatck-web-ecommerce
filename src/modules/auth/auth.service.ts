import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'

import * as bcrypt from 'bcrypt'
import { Model } from 'mongoose'

import { UserService } from '../users/users.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { User, UserDocument } from '../users/schemas/user.schema'

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {

    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    //--------------------HELPER-----------------------

    private getRefreshSecret(): string {
        return this.configService.get<string>('JWT_REFRESH_SECRET')
            ?? this.configService.getOrThrow<string>('JWT_REFERESH_SECRET')
    };

    private async generateTokens(user: UserDocument) {
        const payload = {
            sub: String(user._id),
            email: user.email,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload),
            this.jwtService.signAsync(payload, {
                secret: this.getRefreshSecret(),
                expiresIn: this.configService.getOrThrow<number>('JWT_REFRESH_EXPIRES_IN'),
            }),
        ]);

        const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
        await this.userModel
            .findByIdAndUpdate(user._id, { refreshToken: hashedRefreshToken })
            .exec();

        return { accessToken, refreshToken }
    };

    private async validateUser(dto: LoginDto): Promise<UserDocument> {
        const user = await this.userService.findByEmail(dto.email)
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        };
        const isMatch = await bcrypt.compare(dto.password, user.password)
        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        };
        return user
    };

    //--------------------CRUD----------------------------

    async register(dto: RegisterDto) {
        const user = await this.userService.createUser(dto)
        const tokens = await this.generateTokens(user)
        return { user, ...tokens }
    };

    async login(dto: LoginDto) {
        const user = await this.validateUser(dto)
        const tokens = await this.generateTokens(user)
        return { user, ...tokens }
    };

    async refreshTokens(dto: RefreshTokenDto) {
        let payload: { sub: string; email: string }
        try {
            payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(
                dto.refreshToken,
                { secret: this.getRefreshSecret() },
            )
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const user = await this.userModel
            .findById(payload.sub)
            .select('+refreshToken')
            .exec();

        if (!user || !user.refreshToken) {
            throw new UnauthorizedException('Access denied');
        }

        const isMatch = await bcrypt.compare(dto.refreshToken, user.refreshToken)
        if (!isMatch) {
            throw new UnauthorizedException('Access denied');
        };

        return this.generateTokens(user)
    };

    async logout(_id: string) {
        await this.userModel
            .findByIdAndUpdate(_id, { refreshToken: null })
            .exec();
        return { message: 'Logged out successfully' }
    };

};
