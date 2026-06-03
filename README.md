# ServiceHub — Enterprise Service Marketplace Platform

> Production-grade, scalable service marketplace (Urban Company–style) built for 10M+ users.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│         Web (React/Vite)    Mobile (PWA)    Admin Panel         │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS / WSS
┌───────────────────────▼─────────────────────────────────────────┐
│                    NGINX API Gateway                             │
│         Rate Limiting · SSL Termination · Load Balancing        │
└───┬──────────────┬──────────────┬──────────────┬────────────────┘
    │              │              │              │
┌───▼───┐    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
│ Auth  │    │Booking  │   │Payment  │   │Notif.   │
│Service│    │Service  │   │Service  │   │Service  │
└───┬───┘    └────┬────┘   └────┬────┘   └────┬────┘
    └──────────────┴──────────────┴──────────────┘
                           │
              ┌────────────┼────────────┐
        ┌─────▼────┐  ┌───▼────┐  ┌───▼───┐
        │ MongoDB  │  │ Redis  │  │BullMQ │
        │  Atlas   │  │ Cache  │  │Queues │
        └──────────┘  └────────┘  └───────┘
```

---

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | React 18, Vite, Tailwind CSS, Redux Toolkit |
| Backend      | Node.js 20, Express 5, Socket.io 4     |
| Database     | MongoDB Atlas (Replica Set)             |
| Cache/Queue  | Redis 7, BullMQ                        |
| Payments     | Razorpay                               |
| Gateway      | NGINX                                  |
| DevOps       | Docker, GitHub Actions CI/CD           |
| Monitoring   | Winston, Sentry, Prometheus            |
| Deployment   | Vercel (FE), AWS ECS (BE), Atlas (DB) |

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- MongoDB Atlas account
- Redis (local or Redis Cloud)
- Razorpay account

### 1. Clone & Install

```bash
git clone https://github.com/yourorg/servicehub.git
cd servicehub

# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 2. Environment Setup

```bash
# server/.env
cp server/.env.example server/.env
# Fill in all required values (see .env.example)

# client/.env
cp client/.env.example client/.env
```

### 3. Run with Docker Compose

```bash
docker-compose up --build
```

This starts:
- Backend API: http://localhost:5000
- Frontend: http://localhost:3000
- Redis: localhost:6379
- NGINX Gateway: http://localhost:80

### 4. Seed Database

```bash
cd server && npm run seed
```

---

## Project Structure

```
servicehub/
├── server/                     # Node.js backend
│   └── src/
│       ├── config/             # DB, Redis, env config
│       ├── models/             # Mongoose schemas
│       ├── middleware/         # Auth, rate limit, validation
│       ├── modules/            # Feature modules (MVC + Service)
│       │   ├── auth/
│       │   ├── booking/
│       │   ├── payment/
│       │   ├── provider/
│       │   ├── admin/
│       │   ├── notification/
│       │   ├── complaint/
│       │   └── review/
│       ├── socket/             # Socket.io handlers
│       ├── jobs/               # BullMQ background jobs
│       ├── services/           # Shared services (SMS, Email, PDF)
│       └── utils/              # Helpers, logger, errors
├── client/                     # React frontend
│   └── src/
│       ├── store/              # Redux Toolkit slices
│       ├── pages/              # Route pages
│       ├── components/         # Reusable components
│       ├── hooks/              # Custom React hooks
│       ├── services/           # API service layer
│       └── utils/              # Frontend utilities
├── nginx/                      # NGINX configuration
├── docker/                     # Dockerfiles
├── .github/workflows/          # CI/CD pipelines
└── docker-compose.yml
```

---

## API Documentation

Full API docs available at: `http://localhost:5000/api-docs` (Swagger UI)

### Core Endpoints

| Method | Endpoint                          | Description              | Auth |
|--------|-----------------------------------|--------------------------|------|
| POST   | /api/auth/send-otp               | Send OTP to phone        | —    |
| POST   | /api/auth/verify-otp             | Verify OTP, issue JWT    | —    |
| GET    | /api/services                    | List all services        | —    |
| POST   | /api/bookings                    | Create booking           | Customer |
| GET    | /api/bookings/:id                | Get booking details      | Auth |
| PUT    | /api/bookings/:id/accept         | Provider accepts booking | Provider |
| POST   | /api/bookings/:id/materials      | Add materials used       | Provider |
| POST   | /api/bookings/:id/complete       | Mark job complete        | Provider |
| POST   | /api/payments/create-order       | Create Razorpay order    | Customer |
| POST   | /api/payments/verify             | Verify payment           | Customer |
| POST   | /api/payments/refund             | Initiate refund          | Admin |
| GET    | /api/admin/dashboard             | Real-time analytics      | Admin |
| GET    | /api/admin/providers             | List providers           | Admin |
| PUT    | /api/admin/providers/:id/approve | Approve provider         | Admin |

---

## Booking Lifecycle

```
PENDING → ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED → PAID
    ↓          ↓          ↓
CANCELLED  TIMEOUT   REJECTED → (Auto-reassign to next provider)
```

---

## Payment Flow

```
Customer → Razorpay Order → Payment → Webhook Verification
                                            ↓
                                    Update Booking Status
                                            ↓
                              ┌─────────────┴────────────┐
                         Admin Commission (%)    Provider Wallet Credit
                                            ↓
                                    Generate GST Invoice
```

---

## Socket.io Events

| Event                    | Direction         | Description              |
|--------------------------|-------------------|--------------------------|
| `booking:new`            | Server → Provider | New booking request       |
| `booking:accepted`       | Server → Customer | Provider accepted         |
| `provider:location`      | Provider → Server | GPS coordinates           |
| `provider:location`      | Server → Customer | Live tracking update      |
| `chat:message`           | Bidirectional     | In-app chat              |
| `booking:status_update`  | Server → All      | Status change broadcast  |
| `notification:push`      | Server → User     | Real-time notification   |

---

## Deployment

### Production Docker Build

```bash
docker build -f docker/server.Dockerfile -t servicehub-api:latest .
docker build -f docker/client.Dockerfile -t servicehub-web:latest .
```

### AWS ECS Deployment

```bash
# Push to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin $ECR_URI
docker tag servicehub-api:latest $ECR_URI/servicehub-api:latest
docker push $ECR_URI/servicehub-api:latest

# Deploy via GitHub Actions (automatic on push to main)
```

### Environment Variables (server/.env.example)

```env
# App
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/servicehub
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=7d
OTP_EXPIRY_MINUTES=10

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=webhook_secret

# Twilio (OTP/SMS)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE=+1234567890

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxx
FROM_EMAIL=noreply@servicehub.in

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx

# Commission
DEFAULT_COMMISSION_PERCENT=20
SURGE_MULTIPLIER_MAX=2.5

# AWS S3 (for KYC docs, invoices)
AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx
AWS_S3_BUCKET=servicehub-prod
AWS_REGION=ap-south-1
```

---

## Security Checklist

- [x] JWT with short expiry + refresh token rotation
- [x] OTP rate limiting (5 attempts/15min per phone)
- [x] API rate limiting (100 req/15min per IP)
- [x] Input validation (Joi schemas on all endpoints)
- [x] Razorpay webhook signature verification
- [x] RBAC middleware on all protected routes
- [x] Helmet.js security headers
- [x] MongoDB injection prevention
- [x] XSS protection
- [x] CORS whitelist

---

## Scalability Features

- Redis caching on service listings, provider profiles (TTL: 5min)
- BullMQ queues for: notifications, booking auto-assign, invoice generation
- Booking retry: if provider rejects/times out → auto-assign next match
- Socket.io with Redis adapter for horizontal scaling
- MongoDB indexes on: location (2dsphere), status, providerId, customerId
- Idempotency keys on all payment endpoints

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). All PRs require passing tests and lint.

---

## License

MIT © ServiceHub Team
