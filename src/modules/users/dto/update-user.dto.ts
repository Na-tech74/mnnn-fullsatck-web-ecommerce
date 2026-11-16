import { PartialType } from '@nestjs/mapped-types'; //PartialType :biến tất cả thuộc tính trong CreateUserDto thành  optional.
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {

}