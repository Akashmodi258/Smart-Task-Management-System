from flask_login import current_user
from flask_socketio import join_room, leave_room, emit
from app import socketio


@socketio.on("connect")
def handle_connect():
    if current_user.is_authenticated:
        room = f"user_{current_user.id}"
        join_room(room)
        emit("connected", {
            "message": f"Connected as {current_user.username}",
            "user_id": current_user.id,
        })
    else:
        return False  # Reject unauthenticated socket connections


@socketio.on("disconnect")
def handle_disconnect():
    if current_user.is_authenticated:
        leave_room(f"user_{current_user.id}")


@socketio.on("ping_server")
def handle_ping():
    emit("pong_server", {"message": "Server is alive!"})
