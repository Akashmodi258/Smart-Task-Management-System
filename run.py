import eventlet
eventlet.monkey_patch()

from app import create_app, socketio
from app.sockets import *  # Register socket event handlers

app = create_app()

if __name__ == "__main__":
    socketio.run(app, debug=True, host="127.0.0.1", port=5000)
