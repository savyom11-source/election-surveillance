# Election Surveillance Platform

A web platform for monitoring live camera footage from polling/election offices
across multiple locations, with role-based access control and AWS-backed
recording storage for audit/validation.

## 📐 Architecture

```
State → District → Office → Camera
```

Users are assigned a role + location scope. They can only view live feeds
and recordings for locations within their scope.

| Role | Access |
|---|---|
| SUPER_ADMIN | All states/districts/offices/cameras + user management |
| STATE_ADMIN | All locations within their assigned state(s) |
| DISTRICT_OBSERVER | All locations within their assigned district(s) |
| OFFICE_OBSERVER | Only their assigned office(s) |

## 📁 Repo Structure

```
election-surveillance/
├── backend/        # Node.js + Express + Prisma API
└── frontend/        # React dashboard (coming in Phase 3)
```

## 🚀 Getting Started

See [`backend/README.md`](./backend/README.md) for backend setup instructions.

## 🛣️ Roadmap

- [x] **Phase 1** — DB schema, backend scaffold, JWT auth, RBAC
- [ ] **Phase 2** — User/role/location/camera CRUD APIs, stream service, recordings (S3)
- [ ] **Phase 3** — React frontend (login, dashboard, location browser, recording viewer, admin panel)
- [ ] **Phase 4** — Infrastructure (S3, transcoder, deployment)
