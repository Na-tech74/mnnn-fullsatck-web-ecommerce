import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @HttpCode(201)
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    };

    @Post('login')
    @HttpCode(200)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    };

    @Post('refresh')
    @HttpCode(200)
    refreshTokens(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshTokens(dto);
    };

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    logout(@Req() req: { user: { _id: string } }) {
        return this.authService.logout(req.user._id);
    };
}
