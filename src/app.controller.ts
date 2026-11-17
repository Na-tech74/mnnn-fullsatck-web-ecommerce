import { Controller, Get, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get()
  @HttpCode(200)
  public getHello(): string {
    return this.appService.getHello();
  }
}
