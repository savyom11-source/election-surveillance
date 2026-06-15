# Election Surveillance Platform — Backend

Node.js + Express + Prisma (PostgreSQL) backend for the Election Surveillance Platform.

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema (8 tables, 5 enums)
│   └── seed.ts            # Seed data (Super Admin + sample locations/users)
├── src/
│   ├── config/
│   │   ├── env.js          # Environment variable loader
│   │   └── prisma.js       # Prisma client singleton
│   ├── controllers/
│   │   └── auth.controller.js
│   ├── middleware/
│   │   ├── authenticate.js # JWT verification
│   │   └── rbac.js          # Role + location scope checks
│   ├── routes/
│   │   ├── index.js
│   │   └── auth.routes.js
│   ├── services/
│   │   └── audit.service.js
│   ├── utils/
│   │   ├── errors.js       # Custom errors + central error handler
│   │   └── jwt.js           # Token generation/verification
│   ├── validators/
│   │   └── auth.validator.js
│   ├── app.js               # Express app (middleware + routes)
│   └── server.js            # Entry point
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.seed.json
```

---

## 🚀 Setup Instructions

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy the example file and fill in your values:
```bash
copy .env.example .env
```
*(On Mac/Linux: `cp .env.example .env`)*

At minimum, set:
- `DATABASE_URL` — your local PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any long random strings
  - Generate one with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 3. Run database migrations
```bash
npm run prisma:migrate
```
This creates all tables defined in `prisma/schema.prisma`.

### 4. Seed initial data
```bash
npm run prisma:seed
```
This creates:
- 1 Super Admin
- 1 State Admin (Rajasthan)
- 1 District Observer (Kota)
- 1 Office Observer (Kota North)
- Sample location hierarchy: Rajasthan → Kota → 2 Offices → 4 Cameras

**Default credentials** (change after first login):
| Role | Email | Password |
|---|---|---|
| Super Admin | admin@election-surveillance.in | Admin@1234 |
| State Admin | rj.admin@election-surveillance.in | Observer@1234 |
| District Observer | kota.observer@election-surveillance.in | Observer@1234 |
| Office Observer | kotanorth.observer@election-surveillance.in | Observer@1234 |

### 5. Start the dev server
```bash
npm run dev
```
Server runs at `http://localhost:5000`

---

## 🔍 Verify it's working

```bash
curl http://localhost:5000/api/health
```

Test login:
```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@election-surveillance.in\",\"password\":\"Admin@1234\"}"
```
*(Windows CMD syntax — use single quotes on Mac/Linux)*

You should get back `accessToken`, `refreshToken`, and `user` info.

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server with nodemon (auto-restart) |
| `npm start` | Start server (production) |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed initial data |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) at localhost:5555 |

---

## 🔐 Roles & Access Model

| Role | Scope |
|---|---|
| `SUPER_ADMIN` | Everything — all states, districts, offices, cameras |
| `STATE_ADMIN` | All locations within assigned state(s) |
| `DISTRICT_OBSERVER` | All locations within assigned district(s) |
| `OFFICE_OBSERVER` | Only assigned office(s) |

Scope is enforced via `user_scopes` table + `rbac.js` middleware on every request.

---

## ✅ What's Implemented (Phase 1)

- [x] Database schema (PostgreSQL via Prisma)
- [x] Seed data
- [x] Express app with security middleware (helmet, cors, rate limiting)
- [x] JWT auth (access + refresh tokens, rotation, revocation)
- [x] RBAC middleware (role checks + location scope filtering)
- [x] Audit logging service
- [x] Central error handling

## ✅ Phase 2 — User & Role Management (Super Admin only)

All endpoints require `Authorization: Bearer <accessToken>` for a `SUPER_ADMIN` user.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List users — query: `page`, `limit`, `role`, `isActive`, `search` |
| `POST` | `/api/users` | Create user — body: `{ name, email, password, role, scope }` |
| `GET` | `/api/users/:id` | Get single user + full scope detail |
| `PATCH` | `/api/users/:id` | Update name/email/role/scope |
| `PATCH` | `/api/users/:id/deactivate` | Soft-deactivate user + revoke tokens |
| `PATCH` | `/api/users/:id/activate` | Reactivate a deactivated user |
| `PATCH` | `/api/users/:id/reset-password` | Admin sets a new password — body: `{ newPassword }` |

### `scope` object shape (used in create/update)
```json
{
  "stateIds": ["uuid-of-state"],
  "districtIds": ["uuid-of-district"],
  "officeIds": ["uuid-of-office"]
}
```
- `SUPER_ADMIN` — scope ignored (full access)
- `STATE_ADMIN` — requires ≥1 `stateIds`
- `DISTRICT_OBSERVER` — requires ≥1 `districtIds`
- `OFFICE_OBSERVER` — requires ≥1 `officeIds`

> Note: scope IDs must reference existing States/Districts/Offices.
> Location CRUD endpoints (to create/list these) are coming in the next step.

### Example — create a District Observer
```json
POST /api/users
{
  "name": "Bundi District Observer",
  "email": "bundi.observer@election-surveillance.in",
  "password": "SecurePass123",
  "role": "DISTRICT_OBSERVER",
  "scope": { "districtIds": ["<bundi-district-uuid>"] }
}
```

## 🔜 Coming Next (Phase 2 continued)
- [ ] Location hierarchy CRUD APIs (States/Districts/Offices/Cameras)
- [ ] Stream service (role-scoped HLS URLs)
- [ ] Recording service (S3 signed URLs)
