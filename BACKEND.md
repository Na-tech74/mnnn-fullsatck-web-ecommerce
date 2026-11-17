# BACKEND — MNNN Fullstack Web Ecommerce

Tài liệu mô tả **hiện trạng thực tế** của backend. Backend là REST API viết bằng **NestJS + TypeScript + MongoDB (Mongoose)**, đã triển khai:

- Đăng ký / đăng nhập bằng email + mật khẩu.
- **JWT access token + refresh token** (refresh token được hash trước khi lưu DB).
- Guard bảo vệ một số route (`GET /users/me`, `POST /auth/logout`).
- CRUD người dùng cơ bản.

Tài liệu tập trung vào **luồng hoạt động** (request đi qua những tầng nào, service nào làm gì), kèm API reference và các lưu ý hiện tại.

---

## 1. Công nghệ sử dụng

| Thành phần | Công nghệ / phiên bản |
| --- | --- |
| Framework | NestJS 12 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Ngôn ngữ | TypeScript 6, target ES2023, `strict: true` |
| Database | MongoDB thông qua `@nestjs/mongoose` + `mongoose` 9 |
| Cấu hình | `@nestjs/config` (đọc `.env`, `isGlobal: true`) |
| Validation | `class-validator` + `class-transformer` qua `ValidationPipe` toàn cục |
| Mã hóa mật khẩu | `bcrypt` (10 salt rounds) |
| JWT | `@nestjs/jwt` (access + refresh với 2 secret riêng) |
| Auth | `@nestjs/passport` + `passport-jwt` (`JwtStrategy`, `JwtAuthGuard`) |
| Lint | `oxlint` + `oxlint-tsgolint` (type-aware) |
| Format | Prettier (`singleQuote`, `trailingComma: all`) |
| Test | Jest 30 + ts-jest, Supertest cho e2e |
| Runtime | Node.js (ESM-only Nest packages — cần Node 20.19+ hoặc 22.12+) |

---

## 2. Kiến trúc module

```text
AppModule
├── ConfigModule (global, đọc .env)
├── DatabaseModule ── MongooseModule.forRootAsync(MONGODB_URI)
├── UserModule
│   ├── MongooseModule.forFeature(User)
│   ├── UserController ──► UserService
│   └── exports: UserService, MongooseModule
└── AuthModule
    ├── imports: UserModule, JwtConfigModule, PassportModule
    ├── AuthController ──► AuthService
    ├── AuthService ──► UserService (query thô) + User model (lấy từ UserModule export)
    ├── JwtStrategy (provider, đăng ký passport strategy 'jwt')
    └── JwtAuthGuard (dùng qua @UseGuards, không cần đăng ký provider)
```

Điểm quan trọng:

- `AuthModule` **import `UserModule`** để dùng `UserService` cho các truy vấn thô (`findByEmail`, `findById`) và `createUser` khi đăng ký.
- `UserModule` export luôn `MongooseModule` nên `AuthModule` dùng chung User model provider, **không đăng ký schema hai lần**.
- `AuthService` **inject thêm User model** để đọc/ghi `refreshToken` — phần này thuộc vòng đời token, không đặt trong `UserService`.
- Hash/so sánh mật khẩu dùng chung `common/utils/password.util.ts` (bcrypt + salt rounds), tránh lặp hằng số ở hai service.
- `UserService.toResponse(user)` map document sang `IUserResponse`; `password`, `refreshToken` có `select: false` nên không xuất hiện trong query mặc định.
- `UserController` dùng `JwtAuthGuard` của Auth. Guard không inject service nào nên không tạo phụ thuộc vòng giữa hai module.
- `JwtStrategy` được khai báo trong `providers` của `AuthModule`; khi app khởi động, passport đăng ký strategy `jwt` toàn cục.

---

## 3. Luồng khởi động (bootstrap)

```text
npm run start:dev
  ▼
src/main.ts
  ├─ NestFactory.create(AppModule)
  │    ├─ ConfigModule.forRoot({ isGlobal: true })  → nạp .env
  │    ├─ DatabaseModule                            → kết nối MongoDB bằng MONGODB_URI
  │    ├─ AuthModule
  │    │    ├─ JwtModule.registerAsync              → đọc JWT_ACCESS_SECRET + JWT_ACCESS_EXPIRES_IN
  │    │    └─ JwtStrategy khởi tạo                 → passport dùng JWT_ACCESS_SECRET
  │    └─ UserModule ── MongooseModule.forFeature(User)
  ├─ app.useGlobalPipes(ValidationPipe)             → whitelist, transform, forbidNonWhitelisted
  └─ app.listen(PORT ?? 3000)
```

Nếu thiếu `MONGODB_URI` hoặc `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN`, app **fail ngay khi khởi động** vì dùng `getOrThrow`.

---

## 4. Luồng hoạt động chính

### 4.1. Đăng ký — `POST /auth/register`

```text
Client
  │ POST /auth/register { name, email, password }
  ▼
ValidationPipe (RegisterDto extends CreateUserDto)
  ▼
AuthController.register
  ▼
AuthService.register
  ├─ UserService.createUser
  │    ├─ bcrypt.hash(password, 10)
  │    ├─ userModel.create({ ...dto, password: hash })
  │    └─ Mongo lỗi 11000 (email trùng) → 409 ConflictException
  └─ generateTokens(user) — auto-login ngay sau đăng ký
  ▼
201 Created { user, accessToken, refreshToken }
```

Lưu ý:

- `RegisterDto` **kế thừa toàn bộ validator** của `CreateUserDto` (name, email, password).
- Đăng ký thành công **cấp luôn token** giống login (rotation/ghi đè `refreshToken` như luồng login).
- Object `user` trong response được map bằng `UserService.toResponse`, không chứa `password` lẫn `refreshToken`.

### 4.2. Đăng nhập — `POST /auth/login`

```text
Client
  │ POST /auth/login { email, password }
  ▼
ValidationPipe (LoginDto)
  ▼
AuthController.login
  ▼
AuthService.validateUser
  ├─ UserService.findByEmail(email) → select('+password')
  │    └─ không tìm thấy user → 401 "Invalid credentials"
  └─ bcrypt.compare(password, user.password)
       └─ sai mật khẩu → 401 "Invalid credentials"
  ▼
AuthService.generateTokens
  ├─ accessToken  = jwtService.signAsync({ _id, email })            (JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRES_IN)
  ├─ refreshToken = jwtService.signAsync({ _id, email }, options)   (JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN)
  └─ bcrypt.hash(refreshToken) → lưu vào user.refreshToken
  ▼
200 OK { user, accessToken, refreshToken }
```

Chi tiết:

- Access token và refresh token được ký **song song** (`Promise.all`), cùng payload `{ _id: String(user._id), email }`.
- Refresh token **không lưu plaintext** — DB chỉ giữ bcrypt hash.
- `user` trả về được map bằng `UserService.toResponse` (shape `IUserResponse`); mọi response đi qua mapper thay vì serialize document.
- Mỗi lần login, refresh token cũ bị **ghi đè** (chỉ phiên gần nhất còn hiệu lực).

### 4.3. Gọi route được bảo vệ (ví dụ `GET /users/me`)

```text
Client
  │ GET /users/me
  │ Authorization: Bearer <accessToken>
  ▼
JwtAuthGuard (AuthGuard('jwt'))
  ▼
JwtStrategy
  ├─ verify chữ ký + hạn dùng bằng JWT_ACCESS_SECRET
  │    └─ thiếu token / sai / hết hạn → 401 "Unauthorized"
  └─ validate(payload) → req.user = { _id: payload._id, email: payload.email }
  ▼
UserController.getProfile
  ▼
UserService.findOne(req.user._id)
  ├─ findById (query thô)
  └─ ensureFound → 404 "User not found" nếu không còn tồn tại
  ▼
200 OK — profile user (không có password, không có refreshToken)
```

> Thứ tự route trong `UserController` phải là `@Get('me')` **trước** `@Get(':id')`, nếu không `me` sẽ bị hiểu là ObjectId và trả `400`.

### 4.4. Refresh token — `POST /auth/refresh`

```text
Client
  │ POST /auth/refresh { refreshToken }
  ▼
ValidationPipe (RefreshTokenDto)
  ▼
AuthService.refreshTokens
  ├─ jwtService.verifyAsync(refreshToken, { secret: JWT_REFRESH_SECRET })
  │    └─ sai chữ ký / hết hạn → 401 "Invalid refresh token"
  ├─ userModel.findById(payload._id).select('+refreshToken')
  │    └─ user không tồn tại hoặc chưa từng login → 401 "Access denied"
  ├─ bcrypt.compare(refreshToken, user.refreshToken)
  │    └─ không khớp → 401 "Access denied"
  └─ generateTokens(user)
       ├─ cấp cặp access + refresh mới
       └─ hash refresh mới → ghi đè user.refreshToken   (rotation)
  ▼
200 OK { accessToken, refreshToken }
```

Lưu ý:

- Response refresh **không** trả lại `user`.
- Vì có rotation, refresh token cũ không dùng lại được sau khi refresh thành công; nếu client gửi token cũ → `401`.
- Access token và refresh token dùng **2 secret khác nhau**, nên không thể dùng lẫn: refresh token không gọi được route bảo vệ, access token không dùng được ở `/auth/refresh`.

### 4.5. Đăng xuất — `POST /auth/logout`

```text
Client
  │ POST /auth/logout
  │ Authorization: Bearer <accessToken>
  ▼
JwtAuthGuard → req.user._id
  ▼
AuthService.logout
  └─ userModel.findByIdAndUpdate(_id, { refreshToken: null })
  ▼
200 OK { "message": "Logged out successfully" }
```

Lưu ý:

- Logout cần **access token còn hiệu lực**. Nếu access token đã hết hạn, client không gọi được endpoint này.
- Refresh token bị xoá → không thể refresh được nữa.
- Access token là JWT stateless nên **vẫn dùng được đến khi hết hạn** (không có blacklist).

### 4.6. CRUD user — `/users`

```text
GET    /users        → UserService.findAll()          → mảng user (public)
GET    /users/:id    → ParseObjectIdPipe → findOne     → 400 nếu id sai, 404 nếu không có
GET    /users/me     → JwtAuthGuard → findOne(_id)  → profile của chính mình
PATCH  /users/:id    → ParseObjectIdPipe → updateUser  → hash password nếu có, 409 nếu email trùng
DELETE /users/:id    → ParseObjectIdPipe → deleteUser  → 404 nếu không có
```

`POST /users` đã được **loại bỏ**; việc tạo user chỉ diễn ra qua `POST /auth/register`.

### 4.7. Luồng xử lý lỗi

```text
Request
  ▼
ValidationPipe        → 400 (body sai, field lạ)
ParseObjectIdPipe     → 400 "Invalid id"
Service (Nest exception)
  ├─ UnauthorizedException → 401
  ├─ NotFoundException     → 404
  └─ ConflictException     → 409
  ▼
Nest exception filter → JSON { message, error, statusCode }
```

---

## 5. Phân chia trách nhiệm Auth vs User

| Method | Nằm ở | Vai trò |
| --- | --- | --- |
| `register` | `AuthService` | Orchestration luồng đăng ký: tạo user rồi cấp token (auto-login) |
| `validateUser` | `AuthService` | Tìm user + so sánh bcrypt + ném 401 |
| `login` | `AuthService` | Validate rồi cấp cặp token |
| `refreshTokens` | `AuthService` | Verify refresh token, rotation token |
| `logout` | `AuthService` | Xoá refresh token khỏi DB |
| `createUser` | `UserService` | Tạo bản ghi, hash password, bắt lỗi trùng email |
| `findByEmail` | `UserService` | Query thô, trả `null` nếu không có (không ném lỗi auth) |
| `findById` | `UserService` | Query thô, trả `null` nếu không có |
| `findAll`, `findOne`, `updateUser`, `deleteUser` | `UserService` | CRUD người dùng |
| `ensureFound`, `handleDuplicateKey` | `UserService` | Helper nội bộ (404 / 409) |

Auth **không** đọc/ghi dữ liệu user qua các method nghiệp vụ auth trong UserService; ngược lại UserService **không** biết gì về JWT/refresh token/`Invalid credentials`.

---

## 6. Cấu trúc thư mục

```text
backend/
├── src/
│   ├── main.ts                          # Bootstrap + ValidationPipe toàn cục
│   ├── app.module.ts                    # Module gốc
│   ├── app.controller.ts                # GET /
│   ├── app.service.ts
│   ├── app.controller.spec.ts
│   ├── configs/
│   │   ├── database.module.ts           # MongooseModule.forRootAsync
│   │   └── jwt.module.ts                # JwtModule.registerAsync (access secret)
│   ├── common/
│   │   ├── constants/
│   │   │   ├── app.constant.ts          # SALT_ROUNDS, DUPLICATE_KEY_CODE
│   │   │   └── messages.constant.ts     # ERROR_MESSAGES, SUCCESS_MESSAGES
│   │   ├── pipes/
│   │   │   └── parse-object-id.pipe.ts  # Validate :id là ObjectId
│   │   └── utils/
│   │       └── password.util.ts         # hashPassword / comparePassword (bcrypt)
│   ├── scripts/
│   │   └── generate-jwt-secret.ts       # Script sinh secret ngẫu nhiên
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts       # register, login, refresh, logout
│       │   ├── auth.service.ts
│       │   ├── dto/
│       │   │   ├── register.dto.ts      # extends CreateUserDto
│       │   │   ├── login.dto.ts
│       │   │   └── refresh-token.dto.ts
│       │   ├── guards/
│       │   │   └── jwt-auth.guard.ts
│       │   ├── interfaces/
│       │   │   └── auth.interface.ts    # IJwtPayload, IAuthTokens, IAuthResult, IAuthenticatedRequest
│       │   └── strategies/
│       │       └── jwt.strategy.ts
│       └── users/
│           ├── users.module.ts
│           ├── users.controller.ts      # me + CRUD /users
│           ├── users.service.ts
│           ├── dto/
│           │   ├── create-user.dto.ts
│           │   └── update-user.dto.ts
│           ├── interfaces/
│           │   └── user.interface.ts    # IUserResponse
│           └── schemas/
│               └── user.schema.ts
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── dist/                                # Build output (gitignored)
├── .env                                 # Biến môi trường (gitignored)
├── nest-cli.json
├── tsconfig.json
├── jest.config.ts
├── package.json
└── BACKEND.md
```

---

## 7. Cài đặt và chạy

### 7.1. Yêu cầu

- Node.js 20.19+ hoặc 22.12+
- MongoDB đang chạy (local hoặc Atlas)

### 7.2. Cài dependencies

```bash
npm install
```

### 7.3. Tạo file `.env`

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mnnn_ecommerce

JWT_ACCESS_SECRET=<chuỗi-ngẫu-nhiên>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<chuỗi-ngẫu-nhiên-khác>
JWT_REFRESH_EXPIRES_IN=7d
```

Sinh secret nhanh:

```bash
npx ts-node src/scripts/generate-jwt-secret.ts
```

> `.env` nằm trong `.gitignore`, không commit lên repository.

### 7.4. Các lệnh npm

| Lệnh | Mô tả |
| --- | --- |
| `npm run start` | Chạy app (không watch) |
| `npm run start:dev` | Chạy dev + watch |
| `npm run start:debug` | Chạy dev + debug + watch |
| `npm run build` | Build ra `dist/` |
| `npm run start:prod` | Chạy bản build (`node dist/main`) |
| `npm run lint` | Lint bằng oxlint (type-aware) cho `src/` và `test/` |
| `npm run format` | Format Prettier |
| `npm run test` | Unit test |
| `npm run test:watch` | Unit test watch |
| `npm run test:cov` | Unit test + coverage |
| `npm run test:e2e` | E2E test |

Server mặc định: `http://localhost:3000`.

---

## 8. Cấu hình ứng dụng

### 8.1. Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `PORT` | Không | `3000` | Port HTTP của server |
| `MONGODB_URI` | **Có** | — | Connection string MongoDB; thiếu → app fail khi khởi động |
| `JWT_ACCESS_SECRET` | **Có** | — | Secret ký/verify access token; thiếu → app fail khi khởi động |
| `JWT_ACCESS_EXPIRES_IN` | **Có** | — | Hạn access token (ví dụ `15m`) |
| `JWT_REFRESH_SECRET` | **Có** | — | Secret ký/verify refresh token |
| `JWT_REFRESH_EXPIRES_IN` | **Có** | — | Hạn refresh token (ví dụ `7d`) |

Access token dùng cấu hình mặc định của `JwtModule` (`jwt.module.ts`). Refresh token được ký/verify với secret + expiry truyền trực tiếp trong `AuthService`.

### 8.2. ValidationPipe toàn cục (`src/main.ts`)

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
}));
```

- `whitelist`: loại bỏ field không khai báo trong DTO.
- `forbidNonWhitelisted`: trả `400` nếu client gửi field lạ.
- `transform`: tự chuyển đổi/ép kiểu dữ liệu đầu vào.

### 8.3. Kết nối database

`DatabaseModule` dùng `MongooseModule.forRootAsync` + `ConfigService` để lấy `MONGODB_URI`. Database mặc định trong dev: `mnnn_ecommerce`, collection `users`.

---

## 9. Data model — User

Collection: `users`

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | Tự sinh | Khóa chính |
| `name` | string | required, trim, max 100 | |
| `email` | string | required, **unique**, lowercase, trim | Lưu chữ thường |
| `password` | string | required, `select: false`, 8–32 ký tự (DTO) | Luôn lưu dạng bcrypt hash |
| `refreshToken` | string \| null | `type: String`, `default: null`, `select: false` | Lưu **bcrypt hash** của refresh token, không lưu plaintext |
| `createdAt` | Date | auto (`timestamps: true`) | |
| `updatedAt` | Date | auto (`timestamps: true`) | |

Hành vi bổ sung trong `user.schema.ts`:

- `password` và `refreshToken` có `select: false` → query mặc định **không** trả về; muốn lấy phải `.select('+password')` hoặc `.select('+refreshToken')`.
- Không có `toJSON` transform: response shape do `UserService.toResponse` (`users.service.ts`) quyết định theo `IUserResponse` (`interfaces/user.interface.ts`).
- Unique index trên `email`; vi phạm trả mã lỗi Mongo `11000` → service bắt và ném `409 Conflict`.

---

## 10. API Reference

Base URL: `http://localhost:3000`

> Chưa có global prefix (không phải `/api/...`) và chưa bật CORS.

### 10.1. Tổng quan endpoint

| Method | Path | Auth | Status | Mô tả |
| --- | --- | --- | --- | --- |
| GET | `/` | Không | 200 | Hello World |
| POST | `/auth/register` | Không | 201 | Đăng ký tài khoản + cấp token |
| POST | `/auth/login` | Không | 200 | Đăng nhập, cấp access + refresh token |
| POST | `/auth/refresh` | Refresh token trong body | 200 | Cấp lại cặp token (rotation) |
| POST | `/auth/logout` | Bearer access token | 200 | Xoá refresh token khỏi DB |
| GET | `/users/me` | Bearer access token | 200 | Profile của chính mình |
| GET | `/users` | Không | 200 | Lấy tất cả user |
| GET | `/users/:id` | Không | 200 | Lấy user theo id |
| PATCH | `/users/:id` | Không | 200 | Cập nhật user |
| DELETE | `/users/:id` | Không | 200 | Xóa user |

### 10.2. DTO và ràng buộc

**CreateUserDto**

| Field | Ràng buộc |
| --- | --- |
| `name` | `@IsString`, `@IsNotEmpty`, `@MaxLength(100)` |
| `email` | `@IsEmail`, `@IsNotEmpty` |
| `password` | `@IsString`, `@IsNotEmpty`, `@MinLength(8)`, `@MaxLength(32)` |

**RegisterDto** = `extends CreateUserDto` → cùng validator, không khai báo lại.

**LoginDto**

| Field | Ràng buộc |
| --- | --- |
| `email` | `@IsEmail`, `@IsNotEmpty` |
| `password` | `@IsString`, `@IsNotEmpty` |

**RefreshTokenDto**

| Field | Ràng buộc |
| --- | --- |
| `refreshToken` | `@IsString`, `@IsNotEmpty` |

**UpdateUserDto** = `PartialType(CreateUserDto)` → mọi field optional; field nào gửi thì vẫn áp dụng validator của field đó.

### 10.3. `GET /`

Response `200`:

```text
Hello World!
```

### 10.4. `POST /auth/register`

Request:

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "secret123"
}
```

Response `201` (password đã bị loại khỏi response, token được cấp ngay):

```json
{
  "user": {
    "_id": "6720f1c2a1b2c3d4e5f60718",
    "name": "Nguyen Van A",
    "email": "a@example.com",
    "createdAt": "2026-11-17T03:00:00.000Z",
    "updatedAt": "2026-11-17T03:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Lỗi thường gặp:

- `400` — body sai định dạng / thiếu field / gửi field lạ.
- `409` — `"Email already exists"`.

### 10.5. `POST /auth/login`

Request:

```json
{
  "email": "a@example.com",
  "password": "secret123"
}
```

Response `200`:

```json
{
  "user": {
    "_id": "6720f1c2a1b2c3d4e5f60718",
    "name": "Nguyen Van A",
    "email": "a@example.com",
    "createdAt": "2026-11-17T03:00:00.000Z",
    "updatedAt": "2026-11-17T03:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Lỗi:

- `401` — `"Invalid credentials"` (sai email hoặc sai mật khẩu, không phân biệt để tránh dò email).
- `400` — body không hợp lệ.

### 10.6. `POST /auth/refresh`

Request:

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response `200`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Lỗi:

- `401` — `"Invalid refresh token"` (sai chữ ký / hết hạn).
- `401` — `"Access denied"` (user không tồn tại hoặc token không khớp hash đã lưu).
- `400` — body không hợp lệ.

### 10.7. `POST /auth/logout`

Header:

```text
Authorization: Bearer <accessToken>
```

Response `200`:

```json
{
  "message": "Logged out successfully"
}
```

Lỗi:

- `401` — thiếu access token / token sai / hết hạn.

### 10.8. `GET /users/me`

Header:

```text
Authorization: Bearer <accessToken>
```

Response `200`:

```json
{
  "_id": "6720f1c2a1b2c3d4e5f60718",
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "createdAt": "2026-11-17T03:00:00.000Z",
  "updatedAt": "2026-11-17T03:00:00.000Z"
}
```

Lỗi: `401` (thiếu/sai/hết hạn token), `404` (user đã bị xoá nhưng token còn hạn).

### 10.9. `GET /users`

Response `200`: mảng user (không có password, không có refreshToken). Không phân trang, trả toàn bộ.

```json
[
  {
    "_id": "6720f1c2a1b2c3d4e5f60718",
    "name": "Nguyen Van A",
    "email": "a@example.com",
    "createdAt": "2026-11-17T03:00:00.000Z",
    "updatedAt": "2026-11-17T03:00:00.000Z"
  }
]
```

### 10.10. `GET /users/:id`

Ví dụ: `GET /users/6720f1c2a1b2c3d4e5f60718`

Response `200`: document user.

Lỗi:

- `400` — `"Invalid id"` nếu `:id` không phải ObjectId hợp lệ (do `ParseObjectIdPipe`).
- `404` — `"User not found"`.

### 10.11. `PATCH /users/:id`

Body là một phần của `CreateUserDto` (mọi field optional). Nếu cập nhật `password`, service hash lại bằng bcrypt trước khi lưu.

```json
{
  "name": "Nguyen Van A (updated)"
}
```

Response `200`: user sau cập nhật (không có password). Lỗi: `400`, `404`, `409` (email trùng).

### 10.12. `DELETE /users/:id`

Response `200` với body rỗng. Lỗi: `400` (id sai), `404` (không tồn tại).

---

## 11. Xử lý lỗi

Backend dùng exception mặc định của NestJS (format JSON chuẩn):

```json
{
  "message": "Email already exists",
  "error": "Conflict",
  "statusCode": 409
}
```

| Mã | Trường hợp | Nguồn |
| --- | --- | --- |
| `400 Bad Request` | Body sai validation, gửi field thừa, hoặc `:id` không phải ObjectId | `ValidationPipe`, `ParseObjectIdPipe` |
| `401 Unauthorized` | Sai email/mật khẩu; refresh token sai/hết hạn/không khớp; thiếu hoặc sai access token | `AuthService`, `JwtStrategy` |
| `404 Not Found` | Không tìm thấy user theo id | `UserService.ensureFound` |
| `409 Conflict` | Email đã tồn tại (register/update) | Bắt lỗi Mongo `11000` trong `UserService.handleDuplicateKey` |
| `500 Internal Server Error` | Lỗi không được xử lý | NestJS mặc định |

Lỗi validation trả `message` dạng mảng:

```json
{
  "message": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

---

## 12. Bảo mật

Đã có:

- Hash mật khẩu bằng bcrypt, salt rounds = 10.
- Refresh token lưu dưới dạng bcrypt hash, không lưu plaintext.
- Password và refresh token hash không bao giờ trả ra ngoài (`select: false` + `UserService.toResponse`).
- Login thất bại luôn trả cùng một thông điệp `"Invalid credentials"` (giảm lộ thông tin email tồn tại).
- Access token và refresh token dùng 2 secret và 2 thời hạn riêng.
- Refresh token rotation: mỗi lần refresh cấp cặp mới và ghi đè hash cũ.
- Route `GET /users/me` và `POST /auth/logout` được bảo vệ bằng `JwtAuthGuard`.
- Validate chặt input, chặn field lạ; validate ObjectId trước khi query.

Chưa có (cần bổ sung trước khi production):

- Guard cho `GET /users`, `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id` — hiện **ai cũng gọi được**, kể cả sửa/xóa user và đổi mật khẩu người khác.
- Phân quyền (role admin/users) và `RolesGuard`.
- Thu hồi access token (blacklist) — logout chỉ xoá refresh token.
- CORS cho frontend chạy khác origin.
- Rate limiting / brute-force protection cho login.
- Helmet, HTTPS, giới hạn kích thước request.
- Quản lý secret qua vault/env an toàn.

---

## 13. Kiểm thử

- `npm run test`: chạy các file `*.spec.ts` (hiện chỉ có `src/app.controller.spec.ts` kiểm tra `getHello()`).
- `npm run test:e2e`: chạy `test/app.e2e-spec.ts`, khởi tạo `AppModule` thật → **cần MongoDB đang chạy** và `.env` hợp lệ (gồm cả JWT secrets), nếu không app sẽ fail khi khởi động.
- `npm run test:cov`: xuất coverage vào `coverage/`.

Hiện chưa có unit test / e2e test riêng cho `AuthService`, `UserService`, các controller, guard và các luồng token.

---

## 14. Quy ước code

- Prettier: `singleQuote: true`, `trailingComma: "all"`.
- Oxlint: type-aware, tắt `typescript/no-explicit-any`, bật `typescript/no-floating-promises`.
- TypeScript strict, `strictPropertyInitialization: false` (thuận tiện cho DTO/schema).
- Mỗi module NestJS gồm: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `schemas/` (nếu cần), `interfaces/`, `guards/`, `strategies/` (với auth).
- Interface/type dùng chung trong module đặt ở `interfaces/*.interface.ts`; util dùng chung đặt ở `common/utils/`.
- Service ném exception của Nest (`NotFoundException`, `ConflictException`, `UnauthorizedException`) thay vì trả mã lỗi thủ công.
- `UserService` chỉ cung cấp **query thô** + CRUD; logic xác thực/token nằm ở `AuthService`.

---

## 15. Hạn chế hiện tại & hướng phát triển

### Đã biết / cần lưu ý

1. **Route `/users` (list/detail/update/delete) chưa được bảo vệ** — bất kỳ ai cũng có thể list/sửa/xóa user, kể cả đổi mật khẩu người khác.
2. **Logout không thu hồi access token** — access token vẫn dùng được đến khi hết hạn (JWT stateless).
3. **Login phân biệt chữ hoa/thường của email** — email lưu lowercase nhưng `findByEmail` query nguyên giá trị client gửi; nên chuẩn hóa `email.toLowerCase()` trước khi query.
4. **Refresh token hash bằng bcrypt** — bcrypt cắt input ở 72 byte; với JWT nên dùng SHA-256 (hoặc lưu raw có kiểm soát) để so sánh chính xác toàn bộ token.
5. **Register tự động đăng nhập** — nếu sau này thêm xác minh email/duyệt tài khoản, cần bỏ `generateTokens` khỏi luồng register.
6. **Chưa có role** — chưa thể phân quyền admin/users.
7. **`GET /users` không phân trang** — sẽ chậm khi dữ liệu lớn.
8. **Service trả Mongoose document** — controller map qua `UserService.toResponse`; nếu cần shape khác nhau cho admin/public thì tách thêm hàm map.
9. **Chưa bật CORS** trong `main.ts` → frontend khác origin sẽ bị chặn.
10. **Chưa có Swagger/OpenAPI** — nên thêm `@nestjs/swagger`.
11. **E2E test phụ thuộc MongoDB thật** — nên dùng `mongodb-memory-server` hoặc database test riêng.
12. **Chưa có rate limit cho login/refresh** — dễ bị brute-force.
13. **Chưa có health check thực sự** — `GET /` chỉ trả `Hello World!`.

### Roadmap gợi ý cho đồ án e-commerce

- [ ] Bảo vệ toàn bộ route `/users` (guard) + `GET /users/me` là nguồn profile chính.
- [ ] Thêm `role` vào User + `RolesGuard` (admin quản lý user/sản phẩm).
- [ ] Module `products` (CRUD, filter, search, phân trang, upload ảnh).
- [ ] Module `categories`.
- [ ] Module `cart` (thêm/xóa/cập nhật số lượng).
- [ ] Module `orders` (checkout, trạng thái đơn, lịch sử mua).
- [ ] Module `reviews` / `ratings`.
- [ ] CORS, Swagger, rate limit, helmet.
- [ ] Seed data + unit/e2e test đầy đủ cho auth flow.
- [ ] Frontend (React/Next.js) kết nối API.

---

## 16. Ghi chú tích hợp Frontend

- Base URL dev: `http://localhost:3000`.
- Gửi/nhận JSON: `Content-Type: application/json`.
- Luồng đề xuất:
  1. `POST /auth/register` (nếu chưa có tài khoản) → nhận ngay `accessToken` + `refreshToken`; hoặc `POST /auth/login` nếu đã có tài khoản.
  2. Lưu `accessToken` (bộ nhớ/state) và `refreshToken` (nơi an toàn, ưu tiên httpOnly cookie nếu backend hỗ trợ).
  3. Gọi API bảo vệ với header `Authorization: Bearer <accessToken>` (ví dụ `GET /users/me`, `POST /auth/logout`).
  4. Khi gặp `401` do access token hết hạn → `POST /auth/refresh` với `{ refreshToken }` → lưu cặp token mới → retry request cũ một lần.
  5. Nếu refresh cũng `401` → xoá token, điều hướng về trang đăng nhập.
- Endpoint auth: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; endpoint user: `/users`, profile: `/users/me`.
- Nếu frontend chạy port khác (Ví dụ Vite 5173 / Next.js 3000), cần bật CORS ở backend hoặc cấu hình proxy.
- Response không bao giờ chứa `password`; refresh token chỉ trả về đúng lúc login/refresh (DB chỉ lưu hash).
