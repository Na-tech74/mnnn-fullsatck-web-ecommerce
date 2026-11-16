import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,//Loại bỏ những thuộc tính không được khai báo trong DTO.
    transform: true,//Chuyển đổi dữ liệu đầu vào.
    forbidNonWhitelisted: true,//Trả lỗi nếu gửi thuộc tính không được khai báo.
  }));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
