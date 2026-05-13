# Focused App Benchmark Report

## Benchmark Summary

Benchmark date (UTC): `2026-05-06T18:14:53Z`  
Environment: `Python 3.13.0` on `darwin` using a temporary `SQLite` benchmark database

## Table 1. System Performance Results

| Metric Area | Endpoint / Operation | Requests | Average Time (ms) | P95 Time (ms) | Average App Processing Time (ms) | Status |
|---|---:|---:|---:|---:|---:|---:|
| App startup | Module import | 1 | 2048.71 | 2048.71 | - | Success |
| Health check | `GET /health` | 15 | 1.99 | 4.77 | 0.09 | 200 |
| Sign in page | `GET /signin` | 10 | 4.37 | 10.46 | 2.25 | 200 |
| Home page | `GET /home` | 10 | 19.17 | 58.10 | 2.17 | 200 |
| Task creation | `POST /api/tasks` | 3 | 44.17 | 48.35 | 42.20 | 201 |
| Task listing | `GET /api/tasks` | 15 | 9.14 | 18.19 | 7.28 | 200 |
| Calendar data | `GET /api/calendar` | 10 | 3.85 | 6.37 | 1.91 | 200 |
| Task detail | `GET /api/tasks/<id>` | 10 | 4.99 | 7.29 | 3.53 | 200 |
| Subtask listing | `GET /api/tasks/<id>/subtasks` | 10 | 4.07 | 5.43 | 2.62 | 200 |

## Table 2. Memory Usage Results

| Metric | Value (MB) |
|---|---:|
| Baseline memory usage | 20.36 |
| Final memory usage | 39.45 |
| Memory increase during benchmark | 19.09 |

## Table 3. AI Speed Results

| Metric | Value |
|---|---:|
| Average AI response time (ms) | 3753.92 |
| Fastest AI response time (ms) | 3220.58 |
| Slowest AI response time (ms) | 4478.70 |

## Table 4. AI Quality Results

| Prompt | Status | Latency (ms) | Subtask Count | Quality Score (/100) | Unique Ratio | Actionability Ratio | Length Fit Ratio |
|---|---:|---:|---:|---:|---:|---:|---:|
| Write an essay about climate change | 200 | 4478.70 | 7 | 90.0 | 1.000 | 0.714 | 1.000 |
| Prepare for an exam | 200 | 3562.49 | 7 | 80.0 | 1.000 | 0.429 | 1.000 |
| Plan a weekly grocery trip | 200 | 3220.58 | 7 | 90.0 | 1.000 | 0.714 | 1.000 |

## Table 5. Aggregate AI Quality Summary

| Metric | Value |
|---|---:|
| Average AI quality score (/100) | 86.7 |
| Successful AI runs | 3 |
| Failed AI runs | 0 |

## Interpretation

The benchmark results show that the application performed efficiently for core task-management operations. The health check, sign-in page, calendar retrieval, task detail retrieval, and subtask retrieval all completed in under 10 ms on average, indicating that the backend routes are lightweight and responsive in a controlled local environment. Task creation was the slowest core application operation at 44.17 ms on average, but this still remained well below the project target of 500 ms for task creation.

The memory profile was stable for a Flask application with database access and AI integration. Memory usage increased by 19.09 MB during the full benchmark run, which is acceptable for this project scope.

The AI task-breakdown feature produced an average response time of 3753.92 ms. This was significantly slower than local CRUD operations because it depended on an external API call. However, the quality of the generated subtasks was strong, with an average score of 86.7/100. All three AI benchmark prompts returned successful results, and each produced 7 distinct subtasks with full length-fit compliance.

Overall, the benchmark indicates that the app is performant for standard productivity features, while the AI feature provides useful output at the cost of higher latency due to network-based model inference.

## Method Notes

- Measurements were taken locally using Flask `test_client()`.
- A temporary SQLite database was used to keep the benchmark isolated and repeatable.
- AI quality was scored heuristically using:
  - uniqueness of subtasks
  - action-oriented phrasing
  - suitable subtask length
  - alignment with the target range of 3 to 7 subtasks
- AI latency included the full round trip to the OpenAI API.
