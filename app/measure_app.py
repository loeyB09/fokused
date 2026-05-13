from __future__ import annotations

import importlib.util
import json
import os
import statistics
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import psutil


PROJECT_DIR = Path(__file__).resolve().parent
APP_FILE = PROJECT_DIR / "app.py"
RESULTS_FILE = PROJECT_DIR / "benchmark_results.json"


@dataclass
class RouteSample:
    name: str
    status_code: int
    wall_ms: float
    app_ms: float | None


def load_app_module(db_path: str):
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ.setdefault("SECRET_KEY", "benchmark-secret-key")

    start = time.perf_counter()
    spec = importlib.util.spec_from_file_location("focused_app_benchmark", APP_FILE)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load Flask app module for benchmarking.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    import_ms = (time.perf_counter() - start) * 1000
    return module, import_ms


def measure_route(client, method: str, url: str, **kwargs) -> RouteSample:
    start = time.perf_counter()
    response = client.open(url, method=method, **kwargs)
    wall_ms = (time.perf_counter() - start) * 1000
    app_ms = response.headers.get("X-Request-Duration-MS")
    return RouteSample(
        name=f"{method} {url}",
        status_code=response.status_code,
        wall_ms=round(wall_ms, 2),
        app_ms=round(float(app_ms), 2) if app_ms else None,
    )


def summarize_samples(samples: list[RouteSample]) -> dict:
    wall = [sample.wall_ms for sample in samples]
    app = [sample.app_ms for sample in samples if sample.app_ms is not None]
    return {
        "requests": len(samples),
        "avg_wall_ms": round(statistics.mean(wall), 2),
        "p95_wall_ms": round(sorted(wall)[max(0, int(len(wall) * 0.95) - 1)], 2),
        "avg_app_ms": round(statistics.mean(app), 2) if app else None,
        "status_codes": sorted({sample.status_code for sample in samples}),
    }


def make_quality_score(subtasks: list[str]) -> dict:
    verbs = {
        "write",
        "review",
        "research",
        "outline",
        "draft",
        "edit",
        "proofread",
        "identify",
        "gather",
        "plan",
        "create",
        "check",
        "revise",
        "format",
        "submit",
        "read",
        "prepare",
        "decide",
        "organize",
        "choose",
    }

    if not subtasks:
        return {
            "subtask_count": 0,
            "unique_ratio": 0.0,
            "actionability_ratio": 0.0,
            "length_fit_ratio": 0.0,
            "score_100": 0.0,
        }

    normalized = [item.strip() for item in subtasks if item.strip()]
    unique_ratio = len(set(item.lower() for item in normalized)) / len(normalized)

    actionable = 0
    length_fit = 0
    for item in normalized:
        words = item.split()
        if words and words[0].lower().strip(".,:;!?") in verbs:
            actionable += 1
        if 3 <= len(item) <= 90:
            length_fit += 1

    actionability_ratio = actionable / len(normalized)
    length_fit_ratio = length_fit / len(normalized)
    count_fit = 1.0 if 3 <= len(normalized) <= 7 else 0.6

    score = (
        unique_ratio * 0.3
        + actionability_ratio * 0.35
        + length_fit_ratio * 0.2
        + count_fit * 0.15
    ) * 100

    return {
        "subtask_count": len(normalized),
        "unique_ratio": round(unique_ratio, 3),
        "actionability_ratio": round(actionability_ratio, 3),
        "length_fit_ratio": round(length_fit_ratio, 3),
        "score_100": round(score, 1),
    }


def main() -> None:
    process = psutil.Process(os.getpid())
    baseline_rss_mb = process.memory_info().rss / (1024 * 1024)

    with tempfile.TemporaryDirectory(prefix="focused-benchmark-") as temp_dir:
        db_path = str(Path(temp_dir) / "benchmark.db")
        module, import_ms = load_app_module(db_path)
        app = module.app

        with app.test_client() as client:
            signup_response = client.post(
                "/signup",
                data={
                    "email": "benchmark@example.com",
                    "username": "benchmark-user",
                    "password": "focused-pass-123",
                },
                follow_redirects=False,
            )
            if signup_response.status_code not in {302, 303}:
                raise RuntimeError(f"Signup failed during benchmark: {signup_response.status_code}")

            health_samples = [measure_route(client, "GET", "/health") for _ in range(15)]
            signin_page_samples = [measure_route(client, "GET", "/signin") for _ in range(10)]
            home_samples = [measure_route(client, "GET", "/home") for _ in range(10)]

            task_payloads = [
                {
                    "title": "Write undergraduate proposal",
                    "due_date": "2026-05-06",
                    "category": "Study",
                    "subtasks": [
                        "Review project requirements",
                        "Draft introduction",
                        "Check formatting rules",
                    ],
                },
                {
                    "title": "Prepare meeting notes",
                    "due_date": "2026-05-07",
                    "category": "Work",
                    "subtasks": ["Collect agenda", "Summarize action items"],
                },
                {
                    "title": "Buy groceries",
                    "due_date": "2026-05-08",
                    "category": "Personal",
                    "subtasks": ["Check fridge", "Write shopping list"],
                },
            ]

            created_task_ids: list[int] = []
            create_samples: list[RouteSample] = []
            for payload in task_payloads:
                started = time.perf_counter()
                response = client.post("/api/tasks", json=payload)
                elapsed_ms = (time.perf_counter() - started) * 1000
                create_samples.append(
                    RouteSample(
                        name="POST /api/tasks",
                        status_code=response.status_code,
                        wall_ms=round(elapsed_ms, 2),
                        app_ms=round(float(response.headers.get("X-Request-Duration-MS", "0")), 2),
                    )
                )
                if response.status_code != 201:
                    raise RuntimeError(f"Task creation failed during benchmark: {response.status_code}")
                created_task_ids.append(response.get_json()["id"])

            list_task_samples = [measure_route(client, "GET", "/api/tasks") for _ in range(15)]
            calendar_samples = [measure_route(client, "GET", "/api/calendar") for _ in range(10)]
            detail_samples = [measure_route(client, "GET", f"/api/tasks/{created_task_ids[0]}") for _ in range(10)]
            subtasks_samples = [
                measure_route(client, "GET", f"/api/tasks/{created_task_ids[0]}/subtasks") for _ in range(10)
            ]

            ai_prompts = [
                "Write an essay about climate change",
                "Prepare for an exam",
                "Plan a weekly grocery trip",
            ]
            ai_results = []
            ai_speed_ms = []

            for prompt in ai_prompts:
                started = time.perf_counter()
                response = client.post("/api/suggest-subtasks", json={"title": prompt})
                elapsed_ms = (time.perf_counter() - started) * 1000
                ai_speed_ms.append(elapsed_ms)
                payload = response.get_json() or {}

                result = {
                    "prompt": prompt,
                    "status_code": response.status_code,
                    "latency_ms": round(elapsed_ms, 2),
                }

                subtasks = payload.get("subtasks") or []
                result["subtasks"] = subtasks
                result["quality"] = make_quality_score(subtasks)
                if response.status_code != 200:
                    result["error"] = payload.get("error", "Unknown AI error")
                ai_results.append(result)

            final_rss_mb = process.memory_info().rss / (1024 * 1024)
            memory_delta_mb = final_rss_mb - baseline_rss_mb

    quality_scores = [
        result["quality"]["score_100"]
        for result in ai_results
        if result["status_code"] == 200 and result["quality"]["subtask_count"] > 0
    ]

    benchmark = {
        "measured_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "environment": {
            "python": sys.version.split()[0],
            "platform": sys.platform,
            "database": "SQLite temporary benchmark database",
        },
        "system_performance": {
            "app_import_ms": round(import_ms, 2),
            "health": summarize_samples(health_samples),
            "signin_page": summarize_samples(signin_page_samples),
            "home_page": summarize_samples(home_samples),
            "task_creation": summarize_samples(create_samples),
            "task_list": summarize_samples(list_task_samples),
            "calendar": summarize_samples(calendar_samples),
            "task_detail": summarize_samples(detail_samples),
            "subtasks": summarize_samples(subtasks_samples),
        },
        "speed": {
            "avg_ai_latency_ms": round(statistics.mean(ai_speed_ms), 2) if ai_speed_ms else None,
            "fastest_ai_latency_ms": round(min(ai_speed_ms), 2) if ai_speed_ms else None,
            "slowest_ai_latency_ms": round(max(ai_speed_ms), 2) if ai_speed_ms else None,
        },
        "memory_usage": {
            "baseline_rss_mb": round(baseline_rss_mb, 2),
            "final_rss_mb": round(final_rss_mb, 2),
            "delta_rss_mb": round(memory_delta_mb, 2),
        },
        "ai_quality": {
            "average_score_100": round(statistics.mean(quality_scores), 1) if quality_scores else None,
            "successful_runs": sum(1 for result in ai_results if result["status_code"] == 200),
            "failed_runs": sum(1 for result in ai_results if result["status_code"] != 200),
            "samples": ai_results,
        },
        "notes": [
            "Performance measurements were taken with Flask test_client() against a temporary SQLite database.",
            "AI quality score is a lightweight heuristic based on uniqueness, actionability, length fit, and target subtask count.",
            "AI latency includes the real OpenAI API round trip when OPENAI_API_KEY is configured.",
        ],
    }

    RESULTS_FILE.write_text(json.dumps(benchmark, indent=2), encoding="utf-8")
    print(f"Wrote benchmark results to {RESULTS_FILE}")


if __name__ == "__main__":
    main()
