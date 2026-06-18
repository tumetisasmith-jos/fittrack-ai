# 🏃 FitTrack AI

A premium full-stack Health & Fitness Tracking System built with Node.js, Express, and Vanilla JavaScript.

## 🚀 Quick Start

```bash
# Clone / open the project
cd fittrack-ai

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

---

## 🔑 Demo Credentials

| Account | Email | Password | Role |
|---|---|---|---|
| Admin | admin@fittrack.ai | admin123 | admin |
| Demo User | demo@fittrack.ai | demo123 | user |

---

## 📁 Project Structure

```
fittrack-ai/
├── backend/
│   ├── server.js           # Express entry point
│   ├── database.js         # SQLite schema + seed data
│   ├── middleware/
│   │   └── auth.js         # JWT middleware
│   └── routes/
│       ├── auth.js         # POST /signup, /login
│       ├── users.js        # GET/PUT /me
│       ├── workouts.js     # CRUD workouts
│       ├── dailylogs.js    # Daily activity logs
│       ├── goals.js        # Goal management
│       ├── bmi.js          # BMI tracking
│       ├── achievements.js # Badge system
│       ├── notifications.js
│       └── admin.js        # Admin analytics
├── frontend/
│   ├── index.html          # Landing page
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── profile.html
│   ├── workouts.html
│   ├── daily-logs.html
│   ├── goals.html
│   ├── analytics.html
│   ├── ai-coach.html
│   ├── admin.html
│   ├── css/
│   │   ├── main.css        # Design system + dark/light theme
│   │   ├── components.css
│   │   ├── dashboard.css
│   │   ├── landing.css
│   │   └── auth.css
│   └── js/
│       ├── auth.js
│       ├── landing.js
│       ├── dashboard.js
│       ├── workouts.js
│       ├── profile.js
│       ├── daily-logs.js
│       ├── goals.js
│       ├── analytics.js
│       ├── ai-coach.js
│       └── admin.js
├── .env.example
├── render.yaml
└── package.json
```

---

## 🗄️ Database

Uses **Node.js built-in SQLite** (`node:sqlite`) — no installation required.

Database file: `fittrack.db` (auto-created on first run)

**Seed data included:**
- 50 realistic users (diverse ages, heights, weights)
- 530+ workouts across 10 types
- 30 days of daily logs per user
- Goals, BMI records, achievements, notifications

---

## 🌐 API Endpoints

```
POST   /api/auth/signup
POST   /api/auth/login

GET    /api/users/me
PUT    /api/users/me

GET    /api/workouts
POST   /api/workouts
DELETE /api/workouts/:id
GET    /api/workouts/stats

GET    /api/daily-logs
POST   /api/daily-logs
GET    /api/daily-logs/today
GET    /api/daily-logs/week

GET    /api/goals
POST   /api/goals
PUT    /api/goals/:id
DELETE /api/goals/:id

GET    /api/bmi
POST   /api/bmi

GET    /api/achievements

GET    /api/notifications
PUT    /api/notifications/:id/read
POST   /api/notifications/mark-all-read
GET    /api/notifications/unread-count

GET    /api/admin/stats        (admin only)
GET    /api/admin/users        (admin only)
GET    /api/admin/analytics    (admin only)
```

---

## ☁️ Deploy to Render

1. Push code to a GitHub repository
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repository
4. Render auto-detects `render.yaml` — click **Deploy**
5. Set environment variable `JWT_SECRET` to a long random string

The `render.yaml` is already configured with the correct build and start commands.

---

## ✨ Features

- 🏋️ **Workout Tracking** — Log 10 workout types with duration & calories
- 📊 **Daily Health Logs** — Steps, water, sleep, mood, energy, weight
- 🎯 **Goal Management** — Set goals with progress tracking
- 📈 **Analytics** — 7 Chart.js charts with time range filtering
- 🤖 **AI Coach** — Rule-based workout plans + chat Q&A
- 🏆 **Gamification** — XP points, levels, 7 achievement badges
- 🔔 **Notifications** — In-app notification system
- 👑 **Admin Panel** — KPIs, user management, platform analytics
- 🌙 **Dark/Light Mode** — Persistent theme toggle
- 📱 **Responsive** — Mobile-first design

---

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (Node.js built-in `node:sqlite`)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Frontend**: Vanilla HTML5 + CSS3 + JavaScript
- **Charts**: Chart.js v4
- **Fonts**: Google Fonts (Outfit + Inter)
- **Icons**: Font Awesome 6

---

## 📝 Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=3000
JWT_SECRET=your_super_secret_key_here
NODE_ENV=development
DB_PATH=./fittrack.db
```
