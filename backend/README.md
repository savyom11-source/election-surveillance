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

## 🔜 Coming Next (Phase 2)
- [ ] User & role management APIs
- [ ] Location hierarchy CRUD APIs
- [ ] Stream service (role-scoped HLS URLs)
- [ ] Recording service (S3 signed URLs)
