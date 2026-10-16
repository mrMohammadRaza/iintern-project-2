# TaskBoard - Full-Stack Kanban Task Management Application

A complete, production-ready, high-performance Kanban Task Management web application built with Node.js, Express, SQLite (`better-sqlite3`), and Vanilla JavaScript.

---

## ✨ Features

- **Trello-Style Responsive UI**: Deep modern slate theme with CSS variables, glassmorphic modals, and horizontal Kanban board scrolling.
- **Native HTML5 Drag & Drop**: Smooth, reactive card dragging across columns and positions with active drop-zone visual feedback.
- **Contiguous Position Re-Indexing**: Transactional position recalculation ($0 \dots n$) ensuring zero gaps or collisions when reordering or moving tasks across columns.
- **Visual Status Badges**:
  - Priority badges: `Low` (Green), `Medium` (Yellow), `High` (Red).
  - Overdue task indicator: Red glowing border and warning pill when `due_date < today` and task is not in the "Done" column.
- **Accessibility & Mobile Fallback**: Integrated "Move to Column" dropdown inside the Task Detail modal for keyboard and touch navigation.
- **Real-Time Client-Side State**: State-driven UI pattern updates DOM instantly without full-page reloads.
- **Comments & Activity Stream**: Threaded discussions with author avatars, relative timestamps, author-only deletion, and audit history.
- **Board Membership & Roles**:
  - `Owner`: Rename board, delete board, invite members by email, remove members.
  - `Member`: Add columns, create/edit/move tasks, post comments.
- **Search & Filtering**: Instant multi-condition task filtering by title keyword, priority, and assignee.
- **Cascading Deletes**: Enforced SQLite foreign keys (`PRAGMA foreign_keys = ON;`) ensuring clean deletion waterfalls.
- **Column Deletion Protection**: Blocks deletion of any column containing tasks with clear error messages.

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js, CORS, Dotenv
- **Database**: SQLite3 via `better-sqlite3` (with WAL mode & Foreign Keys enabled)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & password hashing (`bcryptjs`)
- **Frontend**: HTML5, Modern CSS3 (Flexbox/Grid, CSS custom properties), Vanilla JavaScript (ES6 Modules)

---

## 📁 Directory Structure

```text
taskboard/
├── server/
│   ├── config/
│   │   └── db.js            # SQLite connection with PRAGMA foreign_keys = ON
│   ├── middleware/
│   │   └── auth.js          # JWT verification & board authorization checks (Owner vs Member)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── boardController.js
│   │   ├── columnController.js
│   │   ├── taskController.js
│   │   └── commentController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── boardRoutes.js
│   │   ├── columnRoutes.js
│   │   ├── taskRoutes.js
│   │   └── commentRoutes.js
│   ├── database/
│   │   ├── schema.sql
│   │   ├── seed.sql
│   │   └── seed.js
│   └── app.js               # Main Express server file
├── public/
│   ├── css/
│   │   └── styles.css       # Complete responsive Trello-style UI theme
│   ├── js/
│   │   ├── api.js           # Fetch wrapper handling Authorization header and errors
│   │   ├── auth.js          # Login & Register handling
│   │   ├── dashboard.js     # User board listing & modal controls
│   │   └── board.js         # Kanban logic, Drag & Drop, Modals, Search/Filter
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   └── board.html
├── .env.example
├── .env
├── package.json
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18+ or v20+)
- npm

### 2. Installation
From the project directory:
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` (already pre-configured):
```ini
PORT=3000
JWT_SECRET=super-secret-taskboard-jwt-key-2026-production-ready
DB_PATH=./server/database/taskboard.db
```

### 4. Database Initialization & Seeding
The database tables and seed data initialize automatically on first server startup!
To manually re-seed at any time:
```bash
npm run seed
```

### 5. Running the Application
```bash
npm start
```
Open your browser and navigate to:
**`http://localhost:3000`**

---

## 👥 Demo Accounts

The database comes pre-seeded with realistic sample accounts (all passwords are `password123`):

| Name | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Demo Admin** | `demo@taskboard.com` | `password123` | Owner of "Sprint 42 - Q4 Core Platform" |
| **Alice Johnson** | `alice@taskboard.com` | `password123` | Owner of "Marketing Website Redesign", Member of Board 1 |
| **Bob Smith** | `bob@taskboard.com` | `password123` | Member of Board 1 |
| **Charlie Brown**| `charlie@taskboard.com`| `password123` | Member |

*Note: Quick login buttons are embedded directly on the login page for 1-click credential filling!*

---

## 🔌 REST API Reference

All protected endpoints require the header `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user | `201`, `400`, `500` |
| `POST` | `/api/auth/login` | Log in and receive JWT token | `200`, `400`, `401`, `500` |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | `200`, `401`, `404` |

### Boards (`/api/boards`)
| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/boards` | List user's boards with stats | `200`, `401`, `500` |
| `POST` | `/api/boards` | Create board + owner + default columns | `201`, `400`, `401`, `500` |
| `GET` | `/api/boards/:id` | Get board details, columns, tasks & members | `200`, `401`, `403`, `404` |
| `PUT` | `/api/boards/:id` | Update board name / description (Owner) | `200`, `400`, `403`, `500` |
| `DELETE`| `/api/boards/:id` | Cascading delete board (Owner) | `200`, `403`, `404`, `500` |
| `POST` | `/api/boards/:id/members` | Add member by email (Owner) | `201`, `400`, `403`, `404` |
| `DELETE`| `/api/boards/:id/members/:userId`| Remove member from board (Owner) | `200`, `400`, `403`, `404` |
| `POST` | `/api/boards/:id/columns` | Add column with auto-incremented position | `201`, `400`, `403` |
| `GET` | `/api/boards/:id/tasks` | Search & filter tasks (`?q=&priority=&assignee=`) | `200`, `401`, `403` |

### Columns (`/api/columns`)
| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `PUT` | `/api/columns/:id` | Rename or re-index column | `200`, `400`, `403`, `404` |
| `DELETE`| `/api/columns/:id` | Delete column (Blocked if contains tasks) | `200`, `400`, `403`, `404` |
| `POST` | `/api/columns/:id/tasks` | Create task at column bottom position | `201`, `400`, `403`, `404` |

### Tasks (`/api/tasks`)
| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks/:id` | Get task details, comments & activity log | `200`, `401`, `403`, `404` |
| `PUT` | `/api/tasks/:id` | Update title, description, priority, due date, assignee | `200`, `400`, `403`, `404` |
| `DELETE`| `/api/tasks/:id` | Delete task & re-index column positions | `200`, `401`, `403`, `404` |
| `PATCH` | `/api/tasks/:id/move` | Move task & contiguous position re-indexing ($0 \dots n$) | `200`, `400`, `403`, `404` |
| `POST` | `/api/tasks/:id/comments` | Post comment on task | `201`, `400`, `403`, `404` |

### Comments (`/api/comments`)
| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `DELETE`| `/api/comments/:id` | Delete comment (Author only) | `200`, `401`, `403`, `404` |

---

## 🔒 Security & Data Integrity

1. **Foreign Key Enforcement**: `db.pragma('foreign_keys = ON;')` is executed unconditionally on database connection.
2. **Cascading Deletes**: Configured on foreign keys so board deletions clean up columns, tasks, comments, and members cleanly.
3. **Password Security**: Passwords are salted and hashed with `bcryptjs` using 10 rounds.
4. **Token Authentication**: Signed JSON Web Tokens with 7-day expiration.
5. **Authorization Verification**: Fine-grained middleware checks owner vs. member roles before granting access to sensitive actions.
