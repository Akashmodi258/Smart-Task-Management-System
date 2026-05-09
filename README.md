# ⬡ TaskForge Assignment — Smart Task Management System

A full-stack task management web app built with **Flask**, **PostgreSQL**, **Pandas & NumPy**, and **WebSockets**.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, Flask 3, Flask-Login |
| Database | PostgreSQL + Flask-SQLAlchemy |
| Real-time | Flask-SocketIO + eventlet |
| Analytics | Pandas, NumPy |
| Frontend | HTML5, CSS3, Vanilla JS |

---

## Project Structure

```
smart_task_manager/
├── run.py                    # App entry point
├── config.py                 # Configuration
├── requirements.txt
├── schema.sql                # PostgreSQL schema
├── .env.example              # Environment template
└── app/
    ├── __init__.py           # App factory
    ├── sockets.py            # WebSocket event handlers
    ├── models/
    │   └── models.py         # User & Task SQLAlchemy models
    ├── routes/
    │   ├── auth.py           # Register / Login / Logout
    │   ├── tasks.py          # Task CRUD REST API
    │   └── analytics.py      # Pandas/NumPy analytics endpoint
    ├── templates/
    │   ├── base.html
    │   ├── auth/
    │   │   ├── login.html
    │   │   └── register.html
    │   └── tasks/
    │       └── dashboard.html
    └── static/
        ├── css/main.css
        └── js/
            ├── main.js
            └── dashboard.js
```

---

## Setup Instructions

### Prerequisites
- Python 3.10+
- PostgreSQL 13+
- pip

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd smart_task_manager
```

### 2. Create & Activate Virtual Environment
```bash
python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure PostgreSQL

Create the database:
```sql
psql -U postgres
CREATE DATABASE task_manager_db;
\q
```

Optionally apply the schema manually:
```bash
psql -U postgres -d task_manager_db -f schema.sql
```

### 5. Set Environment Variables

Copy the example and fill in your values:
```bash
cp .env.example .env
```

Edit `.env`:
```env
SECRET_KEY=sankar_group_001
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/task_manager_db
```

### 6. Run the App

Flask-SQLAlchemy will auto-create tables on first run:
```bash
python run.py
```

Open your browser at: **http://localhost:5000**

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| GET | `/auth/logout` | Logout |
| GET | `/auth/me` | Current user info |

### Tasks (requires login)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | Get all tasks (supports `?status=`, `?priority=`, `?search=`) |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/<id>` | Get single task |
| PUT | `/api/tasks/<id>` | Update task |
| DELETE | `/api/tasks/<id>` | Delete task |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/summary` | Pandas/NumPy computed stats |

### Task Payload
```json
{
  "title": "Fix login bug",
  "description": "Users can't log in on mobile",
  "priority": "high",
  "status": "in_progress",
  "due_date": "2026-05-15T18:00:00"
}
```

**Priority values:** `low`, `medium`, `high`, `critical`  
**Status values:** `pending`, `in_progress`, `completed`, `cancelled`

---

## WebSocket Events

| Event (server → client) | Payload | Description |
|---|---|---|
| `connected` | `{ message, user_id }` | On successful socket connection |
| `task_created` | Task object | When a new task is added |
| `task_updated` | Task object | When a task is modified |
| `task_deleted` | `{ id }` | When a task is removed |

---

## Features

- **Authentication** — Register, login, logout with secure password hashing
- **Task CRUD** — Create, read, update, delete tasks via REST API
- **Filters** — Filter by status, priority, and search by title
- **Analytics** — Live stats powered by Pandas & NumPy (completion %, priority breakdown, daily creation trend)
- **WebSockets** — Real-time task list updates across all tabs
- **Responsive UI** — Works on desktop and mobile

---

## Submission

- GitHub Repository: *(add your link here)*
- Database Schema: `schema.sql`
- Demo Video: *(add your link here)*
