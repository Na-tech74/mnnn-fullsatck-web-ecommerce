import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UserService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {

    constructor(private readonly userService: UserService) { }

    async register(dto: RegisterDto): Promise<UserDocument> {
        return this.userService.createUser(dto)
    };

    async login(dto: LoginDto): Promise<UserDocument> {
        const user = await this.userService.findByEmailWithPassword(dto.email)
        const isMatch = await bcrypt.compare(dto.password, user.password)
        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        };
        return user
    };
};