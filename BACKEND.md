# BACKEND — MNNN Fullstack Web Ecommerce

Tài liệu mô tả **hiện trạng thực tế** của backend tại thời điểm viết. Backend là REST API viết bằng **NestJS + TypeScript + MongoDB (Mongoose)**, hiện đã có chức năng **đăng ký / đăng nhập bằng email + mật khẩu** và **CRUD người dùng**. Xác thực bằng JWT **chưa được triển khai** (các package đã cài nhưng chưa nối vào code).

---

## 1. Công nghệ sử dụng

| Thành phần | Công nghệ / phiên bản |
| --- | --- |
| Framework | NestJS 12 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Ngôn ngữ | TypeScript 6, target ES2023, `strict: true` |
| Database | MongoDB thông qua `@nestjs/mongoose` + `mongoose` 9 |
| Cấu hình | `@nestjs/config` (đọc biến môi trường từ `.env`, `isGlobal: true`) |
| Validation | `class-validator` + `class-transformer` qua `ValidationPipe` toàn cục |
| Mã hóa mật khẩu | `bcrypt` (10 salt rounds) |
| Auth packages (đã cài, **chưa dùng**) | `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt` |
| Lint | `oxlint` + `oxlint-tsgolint` (type-aware) |
| Format | Prettier (`singleQuote`, `trailingComma: all`) |
| Test | Jest 30 + ts-jest, Supertest cho e2e |
| Runtime | Node.js (ESM-only Nest packages — cần Node 20.19+ hoặc 22.12+) |

---

## 2. Chức năng hiện có

- Kết nối MongoDB qua biến môi trường `MONGODB_URI`.
- `GET /` trả về chuỗi `Hello World!` (health check tối giản).
- Đăng ký tài khoản: `POST /auth/register`.
- Đăng nhập: `POST /auth/login` (so sánh mật khẩu bằng bcrypt).
- CRUD người dùng: tạo, lấy danh sách, lấy chi tiết, cập nhật, xóa.
- Mật khẩu được hash bằng bcrypt trước khi lưu; không trả về trong response.
- Chống trùng email (unique index) và trả `409 Conflict`.
- Validate dữ liệu đầu vào bằng DTO + `ValidationPipe` toàn cục.
- Validate `:id` trên URL là ObjectId hợp lệ trước khi vào service.
- Tự động thêm `createdAt` / `updatedAt` cho user.

**Chưa có:** JWT access/refresh token, guard bảo vệ route, phân quyền/role, CORS, Swagger, phân trang, rate limiting, các module sản phẩm/giỏ hàng/đơn hàng.

---

## 3. Cấu trúc thư mục

```text
backend/
├── src/
│   ├── main.ts                          # Bootstrap app, ValidationPipe toàn cục
│   ├── app.module.ts                    # Module gốc (Config, Database, Auth, User)
│   ├── app.controller.ts                # GET /
│   ├── app.service.ts                   # Trả "Hello World!"
│   ├── app.controller.spec.ts           # Unit test mặc định
│   ├── configs/
│   │   └── database-module.config.ts    # MongooseModule.forRootAsync
│   ├── common/
│   │   └── pipes/
│   │       └── parse-object-id.pipe.ts  # Validate tham số :id
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts       # POST /auth/register, POST /auth/login
│       │   ├── auth.service.ts
│       │   └── dto/
│       │       ├── register.dto.ts
│       │       └── login.dto.ts
│       └── users/
│           ├── users.module.ts
│           ├── users.controller.ts      # CRUD /user
│           ├── users.service.ts
│           ├── dto/
│           │   ├── create-user.dto.ts
│           │   └── update-user.dto.ts
│           └── schemas/
│               └── user.schema.ts       # Mongoose User schema
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

## 4. Cài đặt và chạy

### 4.1. Yêu cầu

- Node.js 20.19+ hoặc 22.12+
- MongoDB đang chạy (local hoặc Atlas)

### 4.2. Cài dependencies

```bash
npm install
```

### 4.3. Tạo file `.env`

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mnnn_ecommerce
```

> `.env` nằm trong `.gitignore`, không commit lên repository.

### 4.4. Các lệnh npm

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

## 5. Cấu hình ứng dụng

### 5.1. Biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `PORT` | Không | `3000` | Port HTTP của server |
| `MONGODB_URI` | **Có** | — | Connection string MongoDB; thiếu sẽ throw khi khởi động (`getOrThrow`) |

### 5.2. ValidationPipe toàn cục (`src/main.ts`)

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
}));
```

- `whitelist`: loại bỏ field không khai báo trong DTO.
- `forbidNonWhitelisted`: trả `400` nếu client gửi field lạ (thay vì âm thầm bỏ).
- `transform`: tự chuyển đổi/ép kiểu dữ liệu đầu vào.

### 5.3. Kết nối database

`DatabaseModule` dùng `MongooseModule.forRootAsync` + `ConfigService` để lấy `MONGODB_URI`. Database mặc định trong dev: `mnnn_ecommerce`, collection `users`.

---

## 6. Data model — User

Collection: `users`

| Field | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `_id` | ObjectId | Tự sinh | Khóa chính |
| `name` | string | required, trim, max 100 | |
| `email` | string | required, **unique**, lowercase, trim | Lưu chữ thường |
| `password` | string | required, `select: false`, 8–32 ký tự (DTO) | Luôn lưu dạng bcrypt hash |
| `createdAt` | Date | auto (`timestamps: true`) | |
| `updatedAt` | Date | auto (`timestamps: true`) | |

Hành vi bổ sung trong `user.schema.ts`:

- `password` có `select: false` → mọi query mặc định **không** trả password.
- `toJSON` transform xóa `password` và `__v` khỏi response.
- Unique index trên `email`; vi phạm trả mã lỗi Mongo `11000` → service bắt và ném `409 Conflict`.

---

## 7. API Reference

Base URL: `http://localhost:3000`

> Chưa có global prefix (không phải `/api/...`) và chưa bật CORS.

### 7.1. Tổng quan endpoint

| Method | Path | Status | Mô tả |
| --- | --- | --- | --- |
| GET | `/` | 200 | Hello World |
| POST | `/auth/register` | 201 | Đăng ký tài khoản |
| POST | `/auth/login` | 200 | Đăng nhập |
| POST | `/user` | 201 | Tạo user |
| GET | `/user` | 200 | Lấy tất cả user |
| GET | `/user/:id` | 200 | Lấy user theo id |
| PATCH | `/user/:id` | 200 | Cập nhật user |
| DELETE | `/user/:id` | 200 | Xóa user |

### 7.2. DTO và ràng buộc

**RegisterDto / CreateUserDto**

| Field | Ràng buộc |
| --- | --- |
| `name` | `@IsString`, `@IsNotEmpty`, `@MaxLength(100)` |
| `email` | `@IsEmail`, `@IsNotEmpty` |
| `password` | `@IsString`, `@IsNotEmpty`, `@MinLength(8)`, `@MaxLength(32)` |

**LoginDto**

| Field | Ràng buộc |
| --- | --- |
| `email` | `@IsEmail`, `@IsNotEmpty` |
| `password` | `@IsString`, `@IsNotEmpty` |

**UpdateUserDto** = `PartialType(CreateUserDto)` → tất cả field optional; nếu gửi field nào thì vẫn áp dụng ràng buộc của field đó.

### 7.3. `GET /`

Response `200`:

```text
Hello World!
```

### 7.4. `POST /auth/register`

Request:

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "secret123"
}
```

Response `201` (password đã bị loại khỏi response):

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "_id": "6720f1c2a1b2c3d4e5f60718",
  "createdAt": "2026-11-17T03:00:00.000Z",
  "updatedAt": "2026-11-17T03:00:00.000Z"
}
```

Lỗi thường gặp:

- `400` — body sai định dạng / thiếu field / gửi field lạ.
- `409` — `"Email already exists"`.

### 7.5. `POST /auth/login`

Request:

```json
{
  "email": "a@example.com",
  "password": "secret123"
}
```

Response `200`: trả về document user (không có password):

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "_id": "6720f1c2a1b2c3d4e5f60718",
  "createdAt": "2026-11-17T03:00:00.000Z",
  "updatedAt": "2026-11-17T03:00:00.000Z"
}
```

Lỗi:

- `401` — `"Invalid credentials"` (sai email hoặc sai mật khẩu, không phân biệt để tránh dò email).
- `400` — body không hợp lệ.

> **Lưu ý:** hiện tại login **không trả JWT/token**, chỉ trả thông tin user. Frontend chưa thể dùng Bearer token.

### 7.6. `POST /user`

Tạo user trực tiếp (không qua auth). Body giống `RegisterDto`.

```json
{
  "name": "Tran Thi B",
  "email": "b@example.com",
  "password": "secret123"
}
```

Response `201`: user vừa tạo (không có password). Lỗi: `400`, `409`.

### 7.7. `GET /user`

Response `200`: mảng user (không có password). Không phân trang, trả toàn bộ.

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

### 7.8. `GET /user/:id`

Ví dụ: `GET /user/6720f1c2a1b2c3d4e5f60718`

Response `200`: document user.

Lỗi:

- `400` — `"Invalid user ID"` nếu `:id` không phải ObjectId hợp lệ (do `ParseObjectIdPipe`).
- `404` — `"User not found"`.

### 7.9. `PATCH /user/:id`

Body là một phần của `CreateUserDto` (mọi field optional). Nếu cập nhật `password`, service hash lại bằng bcrypt trước khi lưu.

```json
{
  "name": "Nguyen Van A (updated)"
}
```

Response `200`: user sau cập nhật. Lỗi: `400`, `404`, `409` (email trùng).

### 7.10. `DELETE /user/:id`

Response `200` với body rỗng. Lỗi: `400` (id sai), `404` (không tồn tại).

---

## 8. Xử lý lỗi

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
| `401 Unauthorized` | Sai email hoặc mật khẩu | `AuthService.login` / `UserService.findByEmailWithPassword` |
| `404 Not Found` | Không tìm thấy user theo id | `UserService.ensureFound` |
| `409 Conflict` | Email đã tồn tại (create/update) | Bắt lỗi Mongo `11000` trong `UserService.handleDuplicateKey` |
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

## 9. Bảo mật

Đã có:

- Hash mật khẩu bằng bcrypt, salt rounds = 10 (`SALT_ROUNDS` trong `users.service.ts`).
- `password` không bao giờ trả ra ngoài (`select: false` + `toJSON` transform).
- Login thất bại luôn trả cùng một thông điệp `"Invalid credentials"` (giảm lộ thông tin email tồn tại).
- Validate chặt input, chặn field lạ.
- Validate ObjectId trước khi query.

Chưa có (cần bổ sung trước khi production):

- JWT access token / refresh token.
- Guard bảo vệ các route `/user` (hiện **ai cũng gọi được**, kể cả sửa/xóa user và đổi mật khẩu).
- Phân quyền (role admin/user).
- CORS cho frontend chạy khác origin.
- Rate limiting / brute-force protection cho login.
- Helmet, HTTPS, giới hạn kích thước request.
- Quản lý secret qua vault/env an toàn.

---

## 10. Kiểm thử

- `npm run test`: chạy các file `*.spec.ts` (hiện chỉ có `src/app.controller.spec.ts` kiểm tra `getHello()`).
- `npm run test:e2e`: chạy `test/app.e2e-spec.ts`, khởi tạo `AppModule` thật → **cần MongoDB đang chạy** và `.env` hợp lệ, nếu không app sẽ fail khi kết nối.
- `npm run test:cov`: xuất coverage vào `coverage/`.

Hiện chưa có unit test / e2e test riêng cho `AuthService`, `UserService`, các controller và validation.

---

## 11. Quy ước code

- Prettier: `singleQuote: true`, `trailingComma: "all"`.
- Oxlint: type-aware, tắt `typescript/no-explicit-any`, bật `typescript/no-floating-promises`.
- TypeScript strict, `strictPropertyInitialization: false` (thuận tiện cho DTO/schema).
- Mỗi module NestJS gồm: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `schemas/`.
- Service ném exception của Nest (`NotFoundException`, `ConflictException`, `UnauthorizedException`) thay vì trả mã lỗi thủ công.

---

## 12. Hạn chế hiện tại & hướng phát triển

### Đã biết / cần lưu ý

1. **Login chưa cấp token** — cần thêm `JwtModule`, `JwtStrategy`, `AuthGuard` và trả `accessToken` (+ refresh token).
2. **Route `/user` không được bảo vệ** — bất kỳ ai cũng có thể list/sửa/xóa user, kể cả đổi mật khẩu người khác.
3. **Chưa bật CORS** trong `main.ts` → frontend khác origin sẽ bị chặn; có thể bật `app.enableCors()` hoặc dùng proxy khi dev.
4. **Login phân biệt chữ hoa/thường của email** — email được lưu lowercase, nhưng `findByEmailWithPassword` query nguyên giá trị client gửi; nên chuẩn hóa `email.toLowerCase()` trước khi query.
5. **`GET /user` không phân trang** — sẽ chậm khi dữ liệu lớn.
6. **Không có response DTO** — trả trực tiếp Mongoose document; nên map sang response DTO để kiểm soát shape dữ liệu.
7. **Chưa có Swagger/OpenAPI** — nên thêm `@nestjs/swagger` để tự sinh tài liệu API.
8. **E2E test phụ thuộc MongoDB thật** — nên dùng `mongodb-memory-server` hoặc database test riêng.
9. **Chưa có health check thực sự** — `GET /` chỉ trả `Hello World!`; có thể dùng `@nestjs/terminus`.

### Roadmap gợi ý cho đồ án e-commerce

- [ ] JWT auth (access + refresh), `JwtAuthGuard`, `@Public()` decorator.
- [ ] Thêm `role` vào User + `RolesGuard`.
- [ ] Module `products` (CRUD, filter, search, phân trang, upload ảnh).
- [ ] Module `categories`.
- [ ] Module `cart` (thêm/xóa/cập nhật số lượng).
- [ ] Module `orders` (checkout, trạng thái đơn, lịch sử mua).
- [ ] Module `reviews` / `ratings`.
- [ ] CORS, Swagger, rate limit, helmet.
- [ ] Seed data + test đầy đủ.

---

## 13. Ghi chú tích hợp Frontend

- Base URL dev: `http://localhost:3000`.
- Gửi/nhận JSON: `Content-Type: application/json`.
- Endpoint auth: `/auth/register`, `/auth/login`; endpoint user: `/user` (số ít).
- Hiện **chưa có** `Authorization: Bearer <token>` vì backend chưa cấp JWT.
- Nếu frontend chạy port khác (ví dụ Vite 5173 / Next.js 3000), cần bật CORS ở backend hoặc cấu hình proxy.
- Response không bao giờ chứa `password`.
