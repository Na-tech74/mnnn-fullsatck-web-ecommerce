import { Controller, Get, HttpCode, Body, Param, Patch, Delete, Req, UseGuards } from "@nestjs/common";
import { UserService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";

import { ParseObjectIdPipe } from "../../common/pipes/parse-object-id.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller('user')
export class UserController {

    constructor(private readonly userService: UserService) { }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    getProfile(@Req() req: { user: { _id: string } }) {
        return this.userService.findOne(req.user._id);
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
