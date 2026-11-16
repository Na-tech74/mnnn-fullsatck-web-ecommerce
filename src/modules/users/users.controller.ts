import { Controller, Post, Get, HttpCode, Body, Param, Put, Patch, Delete } from "@nestjs/common";
import { UserService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

import { ParseObjectIdPipe } from "../../common/pipes/parse-object-id.pipe";

@Controller('user')
export class UserController {

    constructor(private readonly userService: UserService) { }

    @Post()
    @HttpCode(201)
    createUser(@Body() dto: CreateUserDto) {
        return this.userService.createUser(dto);
    };

    @Get()
    @HttpCode(200)
    findAll() {
        return this.userService.findAll();
    };

    @Get(':id')
    @HttpCode(200)
    findOne(@Param('id', ParseObjectIdPipe) _id: string) {
        return this.userService.findOne(_id);
    };


    @Patch(':id')
    @HttpCode(200)
    updateUser(@Param('id', ParseObjectIdPipe) _id: string, @Body() dto: UpdateUserDto,) {
        return this.userService.updateUser(_id, dto);
    };

    @Delete(':id')
    @HttpCode(200)
    deleteUser(@Param('id', ParseObjectIdPipe) _id: string) {
        return this.userService.deleteUser(_id)
    };
}