import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type {
  IAuthResult,
  IAuthTokens,
  IAuthenticatedRequest,
  IMessageResponse,
} from './interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  public register(@Body() dto: RegisterDto): Promise<IAuthResult> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  public login(@Body() dto: LoginDto): Promise<IAuthResult> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  public refreshTokens(@Body() dto: RefreshTokenDto): Promise<IAuthTokens> {
    return this.authService.refreshTokens(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  public logout(@Req() req: IAuthenticatedRequest): Promise<IMessageResponse> {
    return this.authService.logout(req.user._id);
  }
}
