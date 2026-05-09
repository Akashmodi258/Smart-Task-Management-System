import numpy as np
import pandas as pd
from flask import Blueprint, jsonify
from flask_login import login_required, current_user
from app.models import Task

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@analytics_bp.route("/summary")
@login_required
def summary():
    """
    Compute task analytics using Pandas & NumPy.
    Returns totals, completion rate, and priority breakdown.
    """
    tasks = Task.query.filter_by(user_id=current_user.id).all()

    if not tasks:
        return jsonify({
            "success": True,
            "analytics": {
                "total_tasks": 0,
                "completed_tasks": 0,
                "pending_tasks": 0,
                "in_progress_tasks": 0,
                "cancelled_tasks": 0,
                "completion_percentage": 0.0,
                "priority_breakdown": {},
                "status_breakdown": {},
                "avg_tasks_per_priority": 0.0,
                "completion_rate_by_priority": {},
            },
        })

    # Build DataFrame
    df = pd.DataFrame([t.to_dict() for t in tasks])
    df["created_at"] = pd.to_datetime(df["created_at"])
    df["updated_at"] = pd.to_datetime(df["updated_at"])

    total = len(df)
    status_counts = df["status"].value_counts().to_dict()
    priority_counts = df["priority"].value_counts().to_dict()

    completed = int(status_counts.get("completed", 0))
    pending = int(status_counts.get("pending", 0))
    in_progress = int(status_counts.get("in_progress", 0))
    cancelled = int(status_counts.get("cancelled", 0))

    # NumPy: completion percentage
    completion_pct = float(np.round((completed / total) * 100, 2)) if total > 0 else 0.0

    # NumPy: average tasks per priority level
    priority_values = np.array(list(priority_counts.values()), dtype=float)
    avg_per_priority = float(np.mean(priority_values)) if len(priority_values) > 0 else 0.0

    # Completion rate per priority (Pandas groupby)
    completion_by_priority = (
        df.groupby("priority")
        .apply(lambda g: round((g["status"] == "completed").sum() / len(g) * 100, 1))
        .to_dict()
    )

    # Tasks created over last 7 days (Pandas date ops)
    today = pd.Timestamp.now().normalize()
    week_ago = today - pd.Timedelta(days=6)
    df["created_at"] = pd.to_datetime(df["created_at"]).dt.tz_localize(None)
    recent_df = df[df["created_at"] >= week_ago]
    daily_creation = (
        recent_df.groupby(recent_df["created_at"].dt.date.astype(str)).size().to_dict()
    )

    return jsonify({
        "success": True,
        "analytics": {
            "total_tasks": total,
            "completed_tasks": completed,
            "pending_tasks": pending,
            "in_progress_tasks": in_progress,
            "cancelled_tasks": cancelled,
            "completion_percentage": completion_pct,
            "priority_breakdown": {k: int(v) for k, v in priority_counts.items()},
            "status_breakdown": {k: int(v) for k, v in status_counts.items()},
            "avg_tasks_per_priority": round(avg_per_priority, 2),
            "completion_rate_by_priority": completion_by_priority,
            "daily_creation_last_7_days": daily_creation,
        },
    })
