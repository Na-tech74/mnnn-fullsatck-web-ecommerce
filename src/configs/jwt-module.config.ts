import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
                signOptions: {
                    expiresIn: configService.getOrThrow<number>('JWT_ACCESS_EXPIRES_IN'),
                },
            }),
        }),
    ],
    exports: [JwtModule]
})
export class JWTModule { }