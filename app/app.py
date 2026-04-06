from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from datetime import UTC, date, datetime
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
DEFAULT_SQLITE_PATH = INSTANCE_DIR / "tasks.db"

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    username = db.Column(db.String(80), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    tasks = db.relationship("Task", back_populates="user", cascade="all, delete-orphan")


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    category = db.Column(db.String(40), nullable=True)
    completed = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user = db.relationship("User", back_populates="tasks")
    subtasks = db.relationship(
        "Subtask",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="Subtask.id.asc()",
    )


class Subtask(db.Model):
    __tablename__ = "subtasks"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    completed = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    task = db.relationship("Task", back_populates="subtasks")


def normalize_database_url(raw_url: str | None) -> str:
    if raw_url:
        if raw_url.startswith("postgres://"):
            return raw_url.replace("postgres://", "postgresql+psycopg://", 1)
        if raw_url.startswith("postgresql://"):
            return raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return raw_url
    return f"sqlite:///{DEFAULT_SQLITE_PATH}"


def parse_due_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def iso_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat()


def serialize_subtask(subtask: Subtask) -> dict:
    return {
        "id": subtask.id,
        "task_id": subtask.task_id,
        "title": subtask.title,
        "completed": 1 if subtask.completed else 0,
        "created_at": iso_datetime(subtask.created_at),
        "updated_at": iso_datetime(subtask.updated_at),
    }


def serialize_task(task: Task) -> dict:
    subtask_count = len(task.subtasks)
    subtask_done = sum(1 for subtask in task.subtasks if subtask.completed)
    return {
        "id": task.id,
        "user_id": task.user_id,
        "title": task.title,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "category": task.category,
        "completed": 1 if task.completed else 0,
        "created_at": iso_datetime(task.created_at),
        "updated_at": iso_datetime(task.updated_at),
        "subtask_count": subtask_count,
        "subtask_done": subtask_done,
    }


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
        instance_path=str(INSTANCE_DIR),
    )

    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    app.config["SQLALCHEMY_DATABASE_URI"] = normalize_database_url(os.environ.get("DATABASE_URL"))
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"

    db.init_app(app)

    @app.before_request
    def start_timer() -> None:
        g.start_time = time.perf_counter()

    @app.after_request
    def add_timing_header(response):
        elapsed_ms = (time.perf_counter() - g.start_time) * 1000
        response.headers["X-Request-Duration-MS"] = f"{elapsed_ms:.2f}"
        return response

    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if session.get("user_id") is None:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Authentication required"}), 401
                return redirect(url_for("signin"))
            return view(*args, **kwargs)

        return wrapped

    def current_user_id() -> int:
        return int(session["user_id"])

    def get_owned_task(task_id: int) -> Task | None:
        stmt = (
            select(Task)
            .options(selectinload(Task.subtasks))
            .where(Task.id == task_id, Task.user_id == current_user_id())
        )
        return db.session.scalar(stmt)

    def get_owned_subtask(subtask_id: int) -> Subtask | None:
        stmt = (
            select(Subtask)
            .join(Subtask.task)
            .options(selectinload(Subtask.task))
            .where(Subtask.id == subtask_id, Task.user_id == current_user_id())
        )
        return db.session.scalar(stmt)

    @app.cli.command("init-db")
    def init_db_command():
        with app.app_context():
            db.create_all()
        print("Initialized the database.")

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/health")
    def healthcheck():
        return jsonify({"status": "ok"}), 200

    @app.route("/home")
    @login_required
    def home():
        return render_template("home.html", username=session.get("username"))

    @app.route("/tasks/<int:task_id>")
    @login_required
    def task_detail(task_id: int):
        return render_template("task_detail.html", username=session.get("username"), task_id=task_id)

    @app.route("/calendar")
    @login_required
    def calendar_page():
        return render_template("calendar.html", username=session.get("username"))

    @app.route("/calendar-grid")
    @login_required
    def calendar_grid_page():
        return render_template("calendar_grid.html", username=session.get("username"))

    @app.route("/timer")
    @login_required
    def timer_page():
        return render_template("timer.html", username=session.get("username"))

    @app.route("/add-task")
    @login_required
    def add_task_page():
        return render_template("add_task.html", username=session.get("username"))

    @app.route("/signup", methods=["GET", "POST"])
    def signup():
        if request.method == "POST":
            email = (request.form.get("email") or "").strip().lower()
            username = (request.form.get("username") or "").strip()
            password = request.form.get("password") or ""

            if not email or not username or not password:
                return render_template("signup.html", error="All fields are required.")

            existing = db.session.scalar(
                select(User).where((User.email == email) | (User.username == username))
            )
            if existing:
                return render_template("signup.html", error="Email or username already exists.")

            user = User(
                email=email,
                username=username,
                password_hash=generate_password_hash(password),
            )
            db.session.add(user)
            db.session.commit()

            session["user_id"] = user.id
            session["username"] = user.username
            return redirect(url_for("home"))

        return render_template("signup.html")

    @app.route("/signin", methods=["GET", "POST"])
    def signin():
        if request.method == "POST":
            email = (request.form.get("email") or "").strip().lower()
            password = request.form.get("password") or ""

            if not email or not password:
                return render_template("signin.html", error="Email and password are required.")

            user = db.session.scalar(select(User).where(User.email == email))
            if user is None or not check_password_hash(user.password_hash, password):
                return render_template("signin.html", error="Invalid credentials.")

            session["user_id"] = user.id
            session["username"] = user.username
            return redirect(url_for("home"))

        return render_template("signin.html")

    @app.route("/logout", methods=["POST"])
    def logout():
        session.clear()
        return redirect(url_for("signin"))

    @app.route("/api/tasks", methods=["GET"])
    @login_required
    def list_tasks():
        date_value = request.args.get("date")
        stmt = (
            select(Task)
            .options(selectinload(Task.subtasks))
            .where(Task.user_id == current_user_id())
            .order_by(Task.created_at.desc())
        )
        if date_value:
            stmt = stmt.where(Task.due_date == parse_due_date(date_value))
        tasks = db.session.scalars(stmt).all()
        return jsonify([serialize_task(task) for task in tasks])

    @app.route("/api/tasks", methods=["POST"])
    @login_required
    def create_task():
        payload = request.get_json(force=True)
        title = (payload.get("title") or "").strip()
        due_date_value = payload.get("due_date")
        category = payload.get("category")
        subtasks = payload.get("subtasks") or []

        if not title:
            return jsonify({"error": "Title is required"}), 400

        task = Task(
            user_id=current_user_id(),
            title=title,
            due_date=parse_due_date(due_date_value),
            category=category,
            completed=False,
        )
        db.session.add(task)
        db.session.flush()

        for value in subtasks:
            subtask_title = (value or "").strip()
            if subtask_title:
                db.session.add(Subtask(task_id=task.id, title=subtask_title, completed=False))

        db.session.commit()
        return jsonify({"id": task.id}), 201

    @app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
    @login_required
    def update_task(task_id: int):
        task = get_owned_task(task_id)
        if task is None:
            return jsonify({"error": "Task not found"}), 404

        payload = request.get_json(force=True)
        changed = False

        if "title" in payload:
            task.title = (payload["title"] or "").strip()
            changed = True
        if "due_date" in payload:
            task.due_date = parse_due_date(payload["due_date"])
            changed = True
        if "completed" in payload:
            task.completed = bool(payload["completed"])
            changed = True

        if not changed:
            return jsonify({"error": "No fields to update"}), 400

        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/tasks/<int:task_id>", methods=["GET"])
    @login_required
    def get_task(task_id: int):
        task = get_owned_task(task_id)
        if task is None:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(serialize_task(task))

    @app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
    @login_required
    def delete_task(task_id: int):
        task = get_owned_task(task_id)
        if task is None:
            return jsonify({"error": "Task not found"}), 404
        db.session.delete(task)
        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/tasks/<int:task_id>/subtasks", methods=["POST"])
    @login_required
    def add_subtask(task_id: int):
        task = get_owned_task(task_id)
        if task is None:
            return jsonify({"error": "Task not found"}), 404

        payload = request.get_json(force=True)
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title is required"}), 400

        subtask = Subtask(task_id=task.id, title=title, completed=False)
        db.session.add(subtask)
        db.session.commit()
        return jsonify({"id": subtask.id}), 201

    @app.route("/api/tasks/<int:task_id>/subtasks", methods=["GET"])
    @login_required
    def list_subtasks(task_id: int):
        task = get_owned_task(task_id)
        if task is None:
            return jsonify({"error": "Task not found"}), 404
        return jsonify([serialize_subtask(subtask) for subtask in task.subtasks])

    @app.route("/api/subtasks/<int:subtask_id>", methods=["PATCH"])
    @login_required
    def update_subtask(subtask_id: int):
        subtask = get_owned_subtask(subtask_id)
        if subtask is None:
            return jsonify({"error": "Subtask not found"}), 404

        payload = request.get_json(force=True)
        changed = False

        if "title" in payload:
            subtask.title = (payload["title"] or "").strip()
            changed = True
        if "completed" in payload:
            subtask.completed = bool(payload["completed"])
            changed = True

        if not changed:
            return jsonify({"error": "No fields to update"}), 400

        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/subtasks/<int:subtask_id>", methods=["DELETE"])
    @login_required
    def delete_subtask(subtask_id: int):
        subtask = get_owned_subtask(subtask_id)
        if subtask is None:
            return jsonify({"error": "Subtask not found"}), 404
        db.session.delete(subtask)
        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/calendar", methods=["GET"])
    @login_required
    def calendar_overview():
        stmt = (
            select(Task.due_date)
            .where(Task.user_id == current_user_id(), Task.due_date.is_not(None))
            .distinct()
            .order_by(Task.due_date)
        )
        dates = [value.isoformat() for value in db.session.scalars(stmt).all() if value is not None]
        return jsonify(dates)

    @app.route("/api/tasks/<int:task_id>/suggest-subtasks", methods=["POST"])
    @login_required
    def suggest_subtasks(task_id: int):
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return jsonify({"error": "OpenAI API key not configured"}), 500

        task = get_owned_task(task_id)
        if task is None:
            return jsonify({"error": "Task not found"}), 404

        model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
        prompt = (
            "Break down the task into 3-7 short, actionable subtasks. "
            "Return ONLY a JSON array of strings.\n"
            f"Task: {task.title}"
        )

        try:
            response_text = call_openai_response(api_key, model, prompt)
            subtasks = parse_subtasks(response_text)
            return jsonify({"subtasks": subtasks})
        except Exception as exc:
            return jsonify({"error": f"OpenAI request failed: {exc}"}), 502

    @app.route("/api/suggest-subtasks", methods=["POST"])
    @login_required
    def suggest_subtasks_from_title():
        payload = request.get_json(force=True)
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title is required"}), 400

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return jsonify({"error": "OpenAI API key not configured"}), 500

        model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
        prompt = (
            "Break down the task into 3-7 short, actionable subtasks. "
            "Return ONLY a JSON array of strings.\n"
            f"Task: {title}"
        )

        try:
            response_text = call_openai_response(api_key, model, prompt)
            subtasks = parse_subtasks(response_text)
            return jsonify({"subtasks": subtasks})
        except Exception as exc:
            return jsonify({"error": f"OpenAI request failed: {exc}"}), 502

    return app


def call_openai_response(api_key: str, model: str, prompt: str) -> str:
    body = json.dumps(
        {
            "model": model,
            "input": prompt,
            "max_output_tokens": 200,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {err.code}: {detail}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Network error: {err.reason}") from err

    if "output_text" in data and data["output_text"]:
        return data["output_text"]

    for item in data.get("output", []):
        if item.get("type") != "message":
            continue
        for part in item.get("content", []):
            if part.get("type") in {"output_text", "text"}:
                return part.get("text", "")
    return ""


def parse_subtasks(text: str) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []

    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    start = text.find("[")
    end = text.rfind("]")
    candidate = text[start : end + 1] if start != -1 and end != -1 and end > start else text

    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, list):
            return [str(value).strip() for value in parsed if str(value).strip()]
    except json.JSONDecodeError:
        pass

    lines = []
    for raw in candidate.splitlines():
        line = raw.strip().lstrip("-*0123456789. ").strip()
        if not line or line in {"[", "]", "json", "`json", "```json", "```"}:
            continue
        line = line.rstrip(",").strip()
        if line.startswith('"') and line.endswith('"') and len(line) >= 2:
            line = line[1:-1].strip()
        if line.startswith("'") and line.endswith("'") and len(line) >= 2:
            line = line[1:-1].strip()
        if line:
            lines.append(line)
    return lines[:7]


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
