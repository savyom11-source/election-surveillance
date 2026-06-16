# Election Surveillance Platform — Backend

Node.js + Express + Prisma (PostgreSQL) backend for the Election Surveillance Platform.

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma         # Database schema (8 tables, 5 enums)
│   └── seed.ts               # Seed data (Super Admin + sample locations/users)
├── src/
│   ├── config/
│   │   ├── env.js            # Environment variable loader & validation
│   │   └── prisma.js         # Prisma client singleton
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── location.controller.js
│   │   ├── camera.controller.js
│   │   └── recording.controller.js
│   ├── middleware/
│   │   ├── authenticate.js   # JWT verification
│   │   ├── rbac.js           # Role + location scope checks
│   │   └── validate.js       # Zod request validation
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── location.routes.js
│   │   ├── camera.routes.js
│   │   └── recording.routes.js
│   ├── services/
│   │   └── audit.service.js
│   ├── utils/
│   │   ├── errors.js
│   │   └── jwt.js
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── user.validator.js
│   │   ├── location.validator.js
│   │   └── camera.validator.js
│   ├── app.js
│   └── server.js
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
```bash
copy .env.example .env
```
Fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- AWS credentials (optional for now — recording playback gracefully degrades)

### 3. Run database migrations
```bash
npm run prisma:migrate
```

### 4. Seed initial data
```bash
npm run prisma:seed
```

**Default credentials:**
| Role | Email | Password |
|---|---|---|
| Super Admin | admin@election-surveillance.in | Admin@1234 |
| State Admin | rj.admin@election-surveillance.in | Observer@1234 |
| District Observer | kota.observer@election-surveillance.in | Observer@1234 |
| Office Observer | kotanorth.observer@election-surveillance.in | Observer@1234 |

### 5. Start dev server
```bash
npm run dev
```
Runs at `http://localhost:5000`

---

## 📡 API Reference

All protected routes require: `Authorization: Bearer <accessToken>`

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/login` | ❌ | Login → returns accessToken + refreshToken |
| POST | `/refresh` | ❌ | Rotate refresh token |
| POST | `/logout` | ❌ | Revoke refresh token |
| GET | `/me` | ✅ | Current user profile + scope |
| POST | `/change-password` | ✅ | Change own password |

### Users — `/api/users` (SUPER_ADMIN only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List users — query: `page`, `limit`, `role`, `isActive`, `search` |
| POST | `/` | Create user with role + scope |
| GET | `/:id` | Get user detail |
| PATCH | `/:id` | Update name/email/role/scope |
| PATCH | `/:id/deactivate` | Soft-deactivate + revoke tokens |
| PATCH | `/:id/activate` | Reactivate user |
| PATCH | `/:id/reset-password` | Admin resets password |

### Locations — `/api/locations`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/tree` | ✅ All | Full State→District→Office tree (scoped) |
| GET | `/states` | ✅ All | List states |
| POST | `/states` | SUPER_ADMIN | Create state |
| GET | `/states/:id` | ✅ All | Get state |
| PATCH | `/states/:id` | SUPER_ADMIN | Update state |
| DELETE | `/states/:id` | SUPER_ADMIN | Deactivate state |
| GET | `/districts?stateId=` | ✅ All | List districts |
| POST | `/districts` | SUPER_ADMIN | Create district |
| GET | `/districts/:id` | ✅ All | Get district |
| PATCH | `/districts/:id` | SUPER_ADMIN | Update district |
| DELETE | `/districts/:id` | SUPER_ADMIN | Deactivate district |
| GET | `/offices?districtId=` | ✅ All | List offices |
| POST | `/offices` | SUPER_ADMIN | Create office |
| GET | `/offices/:id` | ✅ All | Get office |
| PATCH | `/offices/:id` | SUPER_ADMIN | Update office |
| DELETE | `/offices/:id` | SUPER_ADMIN | Deactivate office |

### Cameras — `/api/cameras`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ All | List cameras (scoped) — query: `officeId`, `districtId`, `stateId`, `status` |
| POST | `/` | SUPER_ADMIN | Create camera |
| GET | `/:id` | ✅ All | Get camera detail |
| PATCH | `/:id` | SUPER_ADMIN | Update camera |
| DELETE | `/:id` | SUPER_ADMIN | Deactivate camera |
| GET | `/:id/stream` | ✅ All | Get HLS URL for live playback |

### Recordings — `/api/recordings`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ All | List recordings (scoped) — query: `cameraId`, `officeId`, `from`, `to` |
| GET | `/:id/play` | ✅ All | Get time-limited signed S3 URL for playback |
| POST | `/` | SUPER_ADMIN | Register a recording (DVR agent call) |

---

## 🔐 Role Access Matrix

| Feature | SUPER_ADMIN | STATE_ADMIN | DISTRICT_OBSERVER | OFFICE_OBSERVER |
|---|---|---|---|---|
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Manage locations | ✅ | ❌ | ❌ | ❌ |
| Manage cameras | ✅ | ❌ | ❌ | ❌ |
| View all cameras | ✅ | State only | District only | Office only |
| View recordings | ✅ | State only | District only | Office only |

---

## ✅ Implementation Status

- [x] Phase 1 — DB schema, backend scaffold, JWT auth, RBAC middleware
- [x] Phase 2 — User management, Location CRUD, Camera CRUD, Stream service, Recording service
- [ ] Phase 3 — React frontend
- [ ] Phase 4 — AWS S3 + FFmpeg transcoder + deployment
