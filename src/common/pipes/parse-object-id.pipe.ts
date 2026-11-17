import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

import { ERROR_MESSAGES } from '../constants/messages.constant';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  public transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_ID);
    }
    return value;
  }
}
