import { Controller, Post, Get, HttpCode, Body, Param } from "@nestjs/common";
import { UserService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Controller('user')
export class UserController {

    constructor(private readonly userService: UserService) { }

    @Post()
    @HttpCode(201)
    createUser(@Body() CreateUserDto: CreateUserDto) {
        return this.userService.createUser(CreateUserDto);
    };

    @Get()
    @HttpCode(200)
    findAll() {
        return this.userService.findAll();
    };

    @Get(':id')
    @HttpCode(200)
    findOne(@Param('id') _id: string) {
        return this.userService.findOne(_id);
    };

}