import type { IUserResponse } from '../../users/interfaces/user.interface';

export interface IJwtPayload {
  _id: string;
  email: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthResult extends IAuthTokens {
  user: IUserResponse;
}

export interface IAuthenticatedRequest {
  user: {
    _id: string;
    email: string;
  };
}

export interface IMessageResponse {
  message: string;
}
