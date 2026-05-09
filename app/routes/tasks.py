from datetime import datetime
from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from flask_login import login_required, current_user
from app import db, socketio
from app.models import Task

tasks_bp = Blueprint("tasks", __name__)


# ── Dashboard (HTML) ──────────────────────────────────────────────────────────

@tasks_bp.route("/")
@login_required
def dashboard():
    return render_template("tasks/dashboard.html", user=current_user)


# ── REST API ──────────────────────────────────────────────────────────────────

@tasks_bp.route("/api/tasks", methods=["GET"])
@login_required
def get_tasks():
    """Get all tasks for the current user with optional filters."""
    status = request.args.get("status")
    priority = request.args.get("priority")
    search = request.args.get("search", "").strip()

    query = Task.query.filter_by(user_id=current_user.id)

    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=priority)
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%"))

    tasks = query.order_by(Task.created_at.desc()).all()
    return jsonify({
        "success": True,
        "tasks": [t.to_dict() for t in tasks],
        "count": len(tasks),
    })


@tasks_bp.route("/api/tasks", methods=["POST"])
@login_required
def add_task():
    """Create a new task."""
    data = request.get_json()

    if not data or not data.get("title", "").strip():
        return jsonify({"success": False, "message": "Title is required."}), 400

    priority = data.get("priority", "medium")
    status = data.get("status", "pending")

    if priority not in Task.PRIORITY_CHOICES:
        return jsonify({"success": False, "message": f"Invalid priority. Choose: {Task.PRIORITY_CHOICES}"}), 400

    if status not in Task.STATUS_CHOICES:
        return jsonify({"success": False, "message": f"Invalid status. Choose: {Task.STATUS_CHOICES}"}), 400

    due_date = None
    if data.get("due_date"):
        try:
            due_date = datetime.fromisoformat(data["due_date"])
        except ValueError:
            return jsonify({"success": False, "message": "Invalid due_date format. Use ISO 8601."}), 400

    task = Task(
        title=data["title"].strip(),
        description=data.get("description", "").strip(),
        priority=priority,
        status=status,
        due_date=due_date,
        user_id=current_user.id,
    )
    db.session.add(task)
    db.session.commit()

    task_data = task.to_dict()

    # Emit real-time WebSocket event
    socketio.emit("task_created", task_data, room=f"user_{current_user.id}")

    return jsonify({"success": True, "message": "Task created successfully.", "task": task_data}), 201


@tasks_bp.route("/api/tasks/<int:task_id>", methods=["GET"])
@login_required
def get_task(task_id: int):
    """Get a single task by ID."""
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    if not task:
        return jsonify({"success": False, "message": "Task not found."}), 404
    return jsonify({"success": True, "task": task.to_dict()})


@tasks_bp.route("/api/tasks/<int:task_id>", methods=["PUT"])
@login_required
def update_task(task_id: int):
    """Update an existing task."""
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    if not task:
        return jsonify({"success": False, "message": "Task not found."}), 404

    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data provided."}), 400

    if "title" in data:
        if not data["title"].strip():
            return jsonify({"success": False, "message": "Title cannot be empty."}), 400
        task.title = data["title"].strip()

    if "description" in data:
        task.description = data["description"].strip()

    if "priority" in data:
        if data["priority"] not in Task.PRIORITY_CHOICES:
            return jsonify({"success": False, "message": f"Invalid priority."}), 400
        task.priority = data["priority"]

    if "status" in data:
        if data["status"] not in Task.STATUS_CHOICES:
            return jsonify({"success": False, "message": f"Invalid status."}), 400
        task.status = data["status"]

    if "due_date" in data:
        if data["due_date"]:
            try:
                task.due_date = datetime.fromisoformat(data["due_date"])
            except ValueError:
                return jsonify({"success": False, "message": "Invalid due_date format."}), 400
        else:
            task.due_date = None

    task.updated_at = datetime.utcnow()
    db.session.commit()

    task_data = task.to_dict()
    socketio.emit("task_updated", task_data, room=f"user_{current_user.id}")

    return jsonify({"success": True, "message": "Task updated successfully.", "task": task_data})


@tasks_bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@login_required
def delete_task(task_id: int):
    """Delete a task by ID."""
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    if not task:
        return jsonify({"success": False, "message": "Task not found."}), 404

    db.session.delete(task)
    db.session.commit()

    socketio.emit("task_deleted", {"id": task_id}, room=f"user_{current_user.id}")

    return jsonify({"success": True, "message": "Task deleted successfully."})
