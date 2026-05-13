const formatDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const autoResizeTextarea = (field) => {
  if (!field) return;
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight}px`;
};

const renderTaskRow = (task) => {
  const done = task.subtask_count ? Math.round((task.subtask_done / task.subtask_count) * 100) : 0;
  return `
    <div class="task-row">
      <input type="checkbox" data-task-id="${task.id}" ${task.completed ? "checked" : ""} />
      <a class="task-title" href="/tasks/${task.id}">${escapeHtml(task.title)}</a>
      <div class="progress-bar" aria-label="Progress ${done}%">
        <div class="progress-fill" style="width:${done}%"></div>
      </div>
    </div>
  `;
};

const dueBadge = (taskDate, today, tomorrow) => {
  if (!taskDate) return { label: "No date", tone: "muted" };
  if (taskDate < today) return { label: "Overdue", tone: "danger" };
  if (taskDate === today) return { label: "Today", tone: "today" };
  if (taskDate === tomorrow) return { label: "Tomorrow", tone: "upcoming" };
  return { label: formatDate(taskDate), tone: "muted" };
};

const renderHomeTaskCard = (task, today, tomorrow, ctaLabel = "Open") => {
  const done = task.subtask_count ? Math.round((task.subtask_done / task.subtask_count) * 100) : 0;
  const badge = dueBadge(task.due_date, today, tomorrow);
  return `
    <article class="home-task-card">
      <div class="home-task-top">
        <label class="task-row home-task-row">
          <input type="checkbox" data-task-id="${task.id}" ${task.completed ? "checked" : ""} />
          <span class="task-title">${escapeHtml(task.title)}</span>
        </label>
        <span class="task-badge task-badge-${badge.tone}">${badge.label}</span>
      </div>
      <div class="home-task-bottom">
        <div class="progress-bar" aria-label="Progress ${done}%">
          <div class="progress-fill" style="width:${done}%"></div>
        </div>
        <a class="task-open-link" href="/tasks/${task.id}">${ctaLabel}</a>
      </div>
    </article>
  `;
};

const renderOverdueList = (overdueTasks) => {
  if (!overdueTasks.length) return "";
  return `
    <section class="home-section hidden" id="overdueSection">
      <div class="home-section-head">
        <h2>Overdue tasks</h2>
        <span>${overdueTasks.length} pending</span>
      </div>
      <div class="home-card-stack">
        ${overdueTasks
          .map(
            (task) => `
              <article class="overdue-item">
                <div class="overdue-main">
                  <a class="task-title" href="/tasks/${task.id}">${escapeHtml(task.title)}</a>
                  <span class="overdue-date">Due ${formatDate(task.due_date)}</span>
                </div>
                <a class="task-open-link" href="/tasks/${task.id}">Open</a>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
};

const renderAllTasksPanel = (tasks) => {
  return `
    <section class="home-section">
      <button class="all-tasks-card" id="allTasksTrigger" type="button">
        <div class="home-section-head">
          <h2>All tasks</h2>
          <span>${tasks.length} total</span>
        </div>
        <p>Tap to view every task you created.</p>
      </button>
      <div class="home-card-stack hidden" id="allTasksSection">
        ${
          tasks.length
            ? tasks
                .map((task) => {
                  const status = task.completed ? "Completed" : "Incomplete";
                  const dueText = task.due_date ? formatDate(task.due_date) : "No date";
                  return `
                    <article class="all-task-item">
                      <div class="all-task-main">
                        <a class="task-title" href="/tasks/${task.id}">${escapeHtml(task.title)}</a>
                        <span class="all-task-date">${dueText}</span>
                      </div>
                      <span class="task-badge ${task.completed ? "task-badge-today" : "task-badge-muted"}">${status}</span>
                    </article>
                  `;
                })
                .join("")
            : `<div class="all-task-empty">No tasks created yet.</div>`
        }
      </div>
    </section>
  `;
};

const bindOverdueToggle = () => {
  const overdueTrigger = document.getElementById("overdueTrigger");
  const overdueSection = document.getElementById("overdueSection");
  if (!overdueTrigger || !overdueSection) return;

  overdueTrigger.addEventListener("click", () => {
    overdueSection.classList.toggle("hidden");
    if (!overdueSection.classList.contains("hidden")) {
      overdueSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
};

const bindAllTasksToggle = () => {
  const trigger = document.getElementById("allTasksTrigger");
  const section = document.getElementById("allTasksSection");
  if (!trigger || !section) return;

  trigger.addEventListener("click", () => {
    section.classList.toggle("hidden");
    if (!section.classList.contains("hidden")) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
};

const bindTaskCheckboxes = (container, onDone) => {
  container.querySelectorAll("input[type=\"checkbox\"][data-task-id]").forEach((box) => {
    box.addEventListener("change", async (event) => {
      const id = event.target.dataset.taskId;
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: event.target.checked ? 1 : 0 }),
      });
      onDone();
    });
  });
};

const todayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const enablePinchNavigate = (container, targetPath) => {
  if (!container) return;
  let startDistance = 0;
  let triggered = false;

  const getDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  container.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 2) {
        startDistance = getDistance(event.touches);
        triggered = false;
      }
    },
    { passive: true }
  );

  container.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length !== 2 || !startDistance || triggered) return;
      const distance = getDistance(event.touches);
      const delta = Math.abs(distance - startDistance);
      if (delta > 30) {
        triggered = true;
        window.location.href = targetPath;
      }
    },
    { passive: true }
  );
};

const loadCalendar = async () => {
  const timeline = document.getElementById("calendarTimeline");
  if (!timeline) return;
  enablePinchNavigate(timeline, "/calendar-grid");

  const response = await fetch("/api/tasks");
  const tasks = await response.json();

  const tasksByDate = tasks.reduce((acc, task) => {
    if (!task.due_date) return acc;
    if (!acc[task.due_date]) acc[task.due_date] = [];
    acc[task.due_date].push(task);
    return acc;
  }, {});

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long" });
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });

  let startOffset = -14;
  let endOffset = 40;

  const createDayNode = (offset) => {
    const date = addDays(today, offset);
    const iso = toISODate(date);
    const dayTasks = tasksByDate[iso] || [];
    const isCurrent = offset === 0;

    const day = document.createElement("article");
    day.className = `calendar-day${isCurrent ? " current" : ""}`;
    day.dataset.date = iso;
    day.innerHTML = `
      <div class="calendar-left">
        <div class="calendar-date-num">${date.getDate()}</div>
        ${
          dayTasks.length
            ? `<ul class="calendar-task-list">
                 ${dayTasks
                   .map(
                     (task) =>
                       `<li class="${task.completed ? "completed" : ""}">
                          <a href="/tasks/${task.id}">${escapeHtml(task.title)}</a>
                        </li>`
                   )
                   .join("")}
               </ul>`
            : `<div class="calendar-empty">No tasks</div>`
        }
      </div>
      <div class="calendar-right">
        <div class="calendar-weekday">${weekdayFmt.format(date)}</div>
        <div class="calendar-month">${monthFmt.format(date)}</div>
      </div>
    `;
    return day;
  };

  const firstDayNode = () => timeline.querySelector(".calendar-day");

  const appendRange = (from, to) => {
    const frag = document.createDocumentFragment();
    for (let offset = from; offset <= to; offset += 1) {
      frag.appendChild(createDayNode(offset));
    }
    timeline.appendChild(frag);
  };

  const prependRange = (from, to) => {
    const first = firstDayNode();
    const prevHeight = timeline.scrollHeight;
    const frag = document.createDocumentFragment();
    for (let offset = from; offset <= to; offset += 1) {
      frag.appendChild(createDayNode(offset));
    }
    if (first) {
      timeline.insertBefore(frag, first);
    } else {
      timeline.appendChild(frag);
    }
    const nextHeight = timeline.scrollHeight;
    window.scrollTo(0, window.scrollY + (nextHeight - prevHeight));
  };

  appendRange(startOffset, endOffset);
  const todayNode = timeline.querySelector(`.calendar-day[data-date="${todayISO()}"]`);
  if (todayNode) {
    const y = todayNode.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: Math.max(0, y), behavior: "auto" });
  }

  let busy = false;
  window.addEventListener("scroll", () => {
    if (busy) return;
    busy = true;
    window.requestAnimationFrame(() => {
      if (window.scrollY < 140) {
        const newStart = startOffset - 14;
        prependRange(newStart, startOffset - 1);
        startOffset = newStart;
      }

      if (window.scrollY + window.innerHeight > document.body.scrollHeight - 260) {
        const oldEnd = endOffset;
        const newEnd = endOffset + 14;
        appendRange(oldEnd + 1, newEnd);
        endOffset = newEnd;
      }
      busy = false;
    });
  });
};

const loadCalendarGrid = async () => {
  const container = document.getElementById("calendarGridView");
  if (!container) return;
  enablePinchNavigate(container, "/calendar");

  const response = await fetch("/api/calendar");
  const datesWithTasks = new Set(await response.json());

  const now = new Date();
  const currentYear = now.getFullYear();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
  const title = document.getElementById("plannerTitle");
  if (title) {
    title.textContent = `${currentYear} planner`;
  }

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const buildMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();

    const section = document.createElement("section");
    section.className = "month-block";
    section.innerHTML = `
      <div class="month-ribbon">${monthFmt.format(date)}</div>
      <div class="month-weekdays">
        ${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}
      </div>
      <div class="month-grid"></div>
    `;

    const grid = section.querySelector(".month-grid");
    for (let i = 0; i < firstWeekday; i += 1) {
      const spacer = document.createElement("div");
      spacer.className = "month-day spacer";
      grid.appendChild(spacer);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const node = document.createElement("a");
      node.className = `month-day ${datesWithTasks.has(iso) ? "has-task" : ""}`;
      node.href = "/calendar";
      node.textContent = String(day);
      node.setAttribute("aria-label", iso);
      grid.appendChild(node);
    }

    return section;
  };

  for (let i = 0; i < 12; i += 1) {
    const monthDate = new Date(currentYear, i, 1);
    container.appendChild(buildMonth(monthDate));
  }
};

const loadHome = async () => {
  const taskList = document.getElementById("taskList");
  if (!taskList) return;

  const today = todayISO();
  const tomorrow = toISODate(addDays(new Date(), 1));
  const res = await fetch("/api/tasks");
  const tasks = await res.json();

  const todayTasks = tasks.filter((task) => task.due_date === today);
  const overdueTasks = tasks.filter((task) => task.due_date && task.due_date < today && !task.completed);
  const tomorrowTasks = tasks.filter((task) => task.due_date === tomorrow && !task.completed);
  const doneToday = todayTasks.filter((task) => task.completed);
  const openToday = todayTasks.filter((task) => !task.completed);
  const startNow = openToday[0] || null;
  const nextUp = openToday.slice(1);

  if (!todayTasks.length) {
    taskList.innerHTML = `
      <section class="home-summary">
        <button class="summary-pill summary-pill-button" id="overdueTrigger" type="button">
          <span class="summary-count">${overdueTasks.length}</span>
          <span>Overdue</span>
        </button>
        <div class="summary-pill">
          <span class="summary-count">${tomorrowTasks.length}</span>
          <span>Tomorrow</span>
        </div>
        <div class="summary-pill">
          <span class="summary-count">0</span>
          <span>Today</span>
        </div>
      </section>
      ${renderOverdueList(overdueTasks)}
      ${renderAllTasksPanel(tasks)}
      <a class="empty-state-link" href="/calendar">
        There's no tasks for today. Check calendar for more tasks.
      </a>
    `;
    bindOverdueToggle();
    bindAllTasksToggle();
    return;
  }

  taskList.innerHTML = `
    <section class="home-summary">
      <button class="summary-pill summary-pill-button" id="overdueTrigger" type="button">
        <span class="summary-count">${overdueTasks.length}</span>
        <span>Overdue</span>
      </button>
      <div class="summary-pill">
        <span class="summary-count">${openToday.length}</span>
        <span>Left today</span>
      </div>
      <div class="summary-pill">
        <span class="summary-count">${tomorrowTasks.length}</span>
        <span>Tomorrow</span>
      </div>
    </section>

    ${renderOverdueList(overdueTasks)}

    ${
      startNow
        ? `
          <section class="home-section">
            <div class="home-section-head">
              <h2>Start now</h2>
              <span>${formatDate(today)}</span>
            </div>
            ${renderHomeTaskCard(startNow, today, tomorrow, "Start focus")}
          </section>
        `
        : ""
    }

    ${
      nextUp.length
        ? `
          <section class="home-section">
            <div class="home-section-head">
              <h2>Next up</h2>
              <span>${nextUp.length} task${nextUp.length > 1 ? "s" : ""}</span>
            </div>
            <div class="home-card-stack">
              ${nextUp.map((task) => renderHomeTaskCard(task, today, tomorrow)).join("")}
            </div>
          </section>
        `
        : ""
    }

    ${
      doneToday.length
        ? `
          <section class="home-section">
            <div class="home-section-head">
              <h2>Done today</h2>
              <span>${doneToday.length} complete</span>
            </div>
            <div class="home-card-stack">
              ${doneToday.map((task) => renderHomeTaskCard(task, today, tomorrow)).join("")}
            </div>
          </section>
        `
        : ""
    }

    <section class="home-horizon">
      <p>
        ${
          overdueTasks.length
            ? `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} need attention. `
            : ""
        }
        ${
          tomorrowTasks.length
            ? `${tomorrowTasks.length} task${tomorrowTasks.length > 1 ? "s" : ""} planned for tomorrow.`
            : "Nothing scheduled for tomorrow yet."
        }
      </p>
      <a class="task-open-link" href="/calendar">Check calendar</a>
    </section>

    ${renderAllTasksPanel(tasks)}
  `;
  bindTaskCheckboxes(taskList, loadHome);
  bindOverdueToggle();
  bindAllTasksToggle();
};

const loadTaskDetail = async () => {
  const container = document.getElementById("taskDetail");
  if (!container) return;

  const taskId = container.dataset.taskId;
  const taskRes = await fetch(`/api/tasks/${taskId}`);
  if (!taskRes.ok) {
    container.innerHTML = `<div class="task-date">Task not found.</div>`;
    return;
  }
  const task = await taskRes.json();
  const subtasksRes = await fetch(`/api/tasks/${taskId}/subtasks`);
  const subtasks = await subtasksRes.json();

  const progress = task.subtask_count
    ? Math.round((task.subtask_done / task.subtask_count) * 100)
    : 0;
  const dateLabel = task.due_date ? formatDate(task.due_date) : "No due date";

  container.innerHTML = `
    <div class="task-date">${dateLabel}</div>
    <div class="task-row">
      <input type="checkbox" data-task-id="${task.id}" ${task.completed ? "checked" : ""} />
      <div class="task-title">${task.title}</div>
      <div class="progress-bar" aria-label="Progress ${progress}%">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
    </div>
    <div class="subtask-card">
      <button class="subtask-close" type="button" aria-label="Close">x</button>
      ${subtasks
        .map(
          (s) => `
          <label class="subtask-row">
            <input type="checkbox" data-subtask-id="${s.id}" ${s.completed ? "checked" : ""} />
            <span>${s.title}</span>
          </label>
        `
        )
        .join("")}
      <div class="subtask-row subtask-add">Add subtask</div>
    </div>
  `;

  container.querySelectorAll("input[type=\"checkbox\"][data-task-id]").forEach((box) => {
    box.addEventListener("change", async (event) => {
      const id = event.target.dataset.taskId;
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: event.target.checked ? 1 : 0 }),
      });
      loadTaskDetail();
    });
  });

  container.querySelectorAll("input[type=\"checkbox\"][data-subtask-id]").forEach((box) => {
    box.addEventListener("change", async (event) => {
      const id = event.target.dataset.subtaskId;
      await fetch(`/api/subtasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: event.target.checked ? 1 : 0 }),
      });
      loadTaskDetail();
    });
  });

  const addRow = container.querySelector(".subtask-add");
  if (addRow) {
    addRow.addEventListener("click", async () => {
      const title = window.prompt("Subtask title");
      if (!title) return;
      await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      loadTaskDetail();
    });
  }
};

const formatSeconds = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const notifyTimerDone = (title, body, noticeEl = null) => {
  if (noticeEl) {
    noticeEl.textContent = `${title}: ${body}`;
    noticeEl.classList.remove("hidden");
  }
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }
    if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, { body });
        }
      });
      return;
    }
  }
};

let sharedAudioContext = null;

const getSharedAudioContext = async () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === "suspended") {
    try {
      await sharedAudioContext.resume();
    } catch (_error) {
      return null;
    }
  }
  return sharedAudioContext;
};

const unlockTimerAudio = async () => {
  await getSharedAudioContext();
};

const playAlarmChime = () => {
  getSharedAudioContext().then((ctx) => {
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.connect(ctx.destination);

    const notes = [
      { freq: 587.33, start: 0.0, duration: 1.1 },
      { freq: 739.99, start: 0.34, duration: 1.05 },
      { freq: 880.0, start: 0.72, duration: 1.2 },
    ];

    notes.forEach((note) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);
      osc2.frequency.setValueAtTime(note.freq * 2, ctx.currentTime + note.start);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1800, ctx.currentTime + note.start);
      filter.Q.setValueAtTime(0.8, ctx.currentTime + note.start);

      noteGain.gain.setValueAtTime(0.0001, ctx.currentTime + note.start);
      noteGain.gain.exponentialRampToValueAtTime(0.17, ctx.currentTime + note.start + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + note.start + 0.18);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + note.start + note.duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(master);

      osc1.start(ctx.currentTime + note.start);
      osc2.start(ctx.currentTime + note.start);
      osc1.stop(ctx.currentTime + note.start + note.duration);
      osc2.stop(ctx.currentTime + note.start + note.duration);
    });

    master.gain.exponentialRampToValueAtTime(0.42, ctx.currentTime + 0.06);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.3);
    window.setTimeout(() => {
      try {
        master.disconnect();
      } catch (_error) {}
    }, 2600);
  });
};

const loadTimerPage = () => {
  const timerPage = document.getElementById("timerPage");
  if (!timerPage) return;

  const modeTitle = document.getElementById("timerModeTitle");
  const prevBtn = document.getElementById("timerPrev");
  const nextBtn = document.getElementById("timerNext");
  const noticeEl = document.getElementById("timerNotice");
  const mySlide = document.getElementById("slideMyTimer");
  const pomoSlide = document.getElementById("slidePomodoro");

  const myDisplay = document.getElementById("myTimerDisplay");
  const myRing = document.getElementById("myTimerRing");
  const myMinutesInput = document.getElementById("myTimerMinutes");
  const myStart = document.getElementById("myTimerStart");
  const myPause = document.getElementById("myTimerPause");
  const myReset = document.getElementById("myTimerReset");

  const pomoWorkDisplay = document.getElementById("pomoWorkDisplay");
  const pomoWorkRing = document.getElementById("pomoWorkRing");
  const pomoRestDisplay = document.getElementById("pomoRestDisplay");
  const pomoRestRing = document.getElementById("pomoRestRing");
  const pomoWorkInput = document.getElementById("pomoWorkMinutes");
  const pomoBreakInput = document.getElementById("pomoBreakMinutes");
  const pomoStart = document.getElementById("pomoStart");
  const pomoPause = document.getElementById("pomoPause");
  const pomoReset = document.getElementById("pomoReset");
  const stopAlarmBtn = document.getElementById("stopAlarmBtn");

  const modes = ["my", "pomodoro"];
  let modeIndex = 0;

  const myState = {
    total: Number(myMinutesInput.value) * 60,
    remaining: Number(myMinutesInput.value) * 60,
    running: false,
    endAt: 0,
  };

  const pomoState = {
    workSeconds: Number(pomoWorkInput.value) * 60,
    breakSeconds: Number(pomoBreakInput.value) * 60,
    remaining: Number(pomoWorkInput.value) * 60,
    phase: "work",
    running: false,
    endAt: 0,
  };

  let alarmIntervalId = null;
  let noticeTimeoutId = null;

  const timerIsActive = () => myState.running || pomoState.running || alarmIntervalId !== null;

  const showTimerNotice = (message, sticky = false) => {
    if (!noticeEl) return;
    noticeEl.textContent = message;
    noticeEl.classList.remove("hidden");
    if (noticeTimeoutId !== null) {
      window.clearTimeout(noticeTimeoutId);
      noticeTimeoutId = null;
    }
    if (!sticky) {
      noticeTimeoutId = window.setTimeout(() => {
        noticeEl.classList.add("hidden");
        noticeEl.textContent = "";
        noticeTimeoutId = null;
      }, 4200);
    }
  };

  const stopRepeatingAlarm = () => {
    if (alarmIntervalId !== null) {
      window.clearInterval(alarmIntervalId);
      alarmIntervalId = null;
    }
    if (noticeTimeoutId !== null) {
      window.clearTimeout(noticeTimeoutId);
      noticeTimeoutId = null;
    }
    if (noticeEl) {
      noticeEl.classList.add("hidden");
      noticeEl.textContent = "";
    }
    if (stopAlarmBtn) {
      stopAlarmBtn.classList.add("hidden");
    }
  };

  const startRepeatingAlarm = () => {
    if (alarmIntervalId !== null) return;
    playAlarmChime();
    alarmIntervalId = window.setInterval(() => {
      playAlarmChime();
    }, 2200);
    if (stopAlarmBtn) {
      stopAlarmBtn.classList.remove("hidden");
    }
  };

  const initRing = (ring) => {
    if (!ring) return 0;
    const radius = Number(ring.dataset.radius || 96);
    const circumference = 2 * Math.PI * radius;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);
    return circumference;
  };

  const setRingProgress = (ring, circumference, ratio) => {
    if (!ring || !circumference) return;
    const bounded = Math.max(0, Math.min(1, ratio));
    ring.style.strokeDashoffset = String(circumference * (1 - bounded));
  };

  const myCirc = initRing(myRing);
  const workCirc = initRing(pomoWorkRing);
  const restCirc = initRing(pomoRestRing);

  const renderMode = () => {
    const mode = modes[modeIndex];
    const isMy = mode === "my";
    modeTitle.textContent = isMy ? "My Timer" : "Pomodoro Timer";
    mySlide.classList.toggle("hidden", !isMy);
    pomoSlide.classList.toggle("hidden", isMy);
  };

  const setMyFromInput = () => {
    const minutes = Math.max(1, Math.min(180, Number(myMinutesInput.value) || 25));
    myMinutesInput.value = String(minutes);
    myState.total = minutes * 60;
    myState.remaining = minutes * 60;
    myDisplay.textContent = formatSeconds(myState.remaining);
    setRingProgress(myRing, myCirc, 0);
  };

  const setPomoFromInput = () => {
    const w = Math.max(1, Math.min(120, Number(pomoWorkInput.value) || 25));
    const b = Math.max(1, Math.min(60, Number(pomoBreakInput.value) || 5));
    pomoWorkInput.value = String(w);
    pomoBreakInput.value = String(b);
    pomoState.workSeconds = w * 60;
    pomoState.breakSeconds = b * 60;
    if (!pomoState.running) {
      pomoState.phase = "work";
      pomoState.remaining = pomoState.workSeconds;
      pomoWorkDisplay.textContent = formatSeconds(pomoState.remaining);
      pomoRestDisplay.textContent = formatSeconds(pomoState.breakSeconds);
      setRingProgress(pomoWorkRing, workCirc, 0);
      setRingProgress(pomoRestRing, restCirc, 0);
    }
  };

  myDisplay.textContent = formatSeconds(myState.remaining);
  pomoWorkDisplay.textContent = formatSeconds(pomoState.workSeconds);
  pomoRestDisplay.textContent = formatSeconds(pomoState.breakSeconds);
  setRingProgress(myRing, myCirc, 0);
  setRingProgress(pomoWorkRing, workCirc, 0);
  setRingProgress(pomoRestRing, restCirc, 0);

  const ticker = window.setInterval(() => {
    const now = Date.now();

    if (myState.running) {
      myState.remaining = Math.ceil((myState.endAt - now) / 1000);
      if (myState.remaining <= 0) {
        myState.remaining = 0;
        myState.running = false;
        startRepeatingAlarm();
        notifyTimerDone("My Timer finished", "Time is up.", noticeEl);
      }
      myDisplay.textContent = formatSeconds(myState.remaining);
      const ratio = (myState.total - myState.remaining) / myState.total;
      setRingProgress(myRing, myCirc, ratio);
    }

    if (pomoState.running) {
      pomoState.remaining = Math.ceil((pomoState.endAt - now) / 1000);
      if (pomoState.remaining <= 0) {
        if (pomoState.phase === "work") {
          startRepeatingAlarm();
          notifyTimerDone("Pomodoro", "Work session finished. Break started.", noticeEl);
          pomoState.phase = "break";
          pomoState.remaining = pomoState.breakSeconds;
          pomoState.endAt = Date.now() + pomoState.breakSeconds * 1000;
        } else {
          startRepeatingAlarm();
          notifyTimerDone("Pomodoro", "Break finished. Work session started.", noticeEl);
          pomoState.phase = "work";
          pomoState.remaining = pomoState.workSeconds;
          pomoState.endAt = Date.now() + pomoState.workSeconds * 1000;
        }
      }

      if (pomoState.phase === "work") {
        pomoWorkDisplay.textContent = formatSeconds(pomoState.remaining);
        pomoRestDisplay.textContent = formatSeconds(pomoState.breakSeconds);
        const workRatio = (pomoState.workSeconds - pomoState.remaining) / pomoState.workSeconds;
        setRingProgress(pomoWorkRing, workCirc, workRatio);
        setRingProgress(pomoRestRing, restCirc, 0);
      } else {
        pomoWorkDisplay.textContent = formatSeconds(pomoState.workSeconds);
        pomoRestDisplay.textContent = formatSeconds(pomoState.remaining);
        const restRatio = (pomoState.breakSeconds - pomoState.remaining) / pomoState.breakSeconds;
        setRingProgress(pomoRestRing, restCirc, restRatio);
        setRingProgress(pomoWorkRing, workCirc, 1);
      }
    }
  }, 300);

  prevBtn.addEventListener("click", () => {
    modeIndex = (modeIndex - 1 + modes.length) % modes.length;
    renderMode();
  });

  nextBtn.addEventListener("click", () => {
    modeIndex = (modeIndex + 1) % modes.length;
    renderMode();
  });

  myMinutesInput.addEventListener("change", setMyFromInput);
  myStart.addEventListener("click", async () => {
    await unlockTimerAudio();
    stopRepeatingAlarm();
    if (!myState.running) {
      if (myState.remaining <= 0) setMyFromInput();
      myState.running = true;
      myState.endAt = Date.now() + myState.remaining * 1000;
    }
  });
  myPause.addEventListener("click", () => {
    if (myState.running) {
      myState.remaining = Math.max(0, Math.ceil((myState.endAt - Date.now()) / 1000));
      myState.running = false;
      myDisplay.textContent = formatSeconds(myState.remaining);
      const ratio = (myState.total - myState.remaining) / myState.total;
      setRingProgress(myRing, myCirc, ratio);
    }
  });
  myReset.addEventListener("click", () => {
    stopRepeatingAlarm();
    myState.running = false;
    setMyFromInput();
  });

  pomoWorkInput.addEventListener("change", setPomoFromInput);
  pomoBreakInput.addEventListener("change", setPomoFromInput);
  pomoStart.addEventListener("click", async () => {
    await unlockTimerAudio();
    stopRepeatingAlarm();
    if (!pomoState.running) {
      if (pomoState.remaining <= 0) setPomoFromInput();
      pomoState.running = true;
      pomoState.endAt = Date.now() + pomoState.remaining * 1000;
    }
  });
  pomoPause.addEventListener("click", () => {
    if (pomoState.running) {
      pomoState.remaining = Math.max(0, Math.ceil((pomoState.endAt - Date.now()) / 1000));
      pomoState.running = false;
      if (pomoState.phase === "work") {
        const workRatio = (pomoState.workSeconds - pomoState.remaining) / pomoState.workSeconds;
        setRingProgress(pomoWorkRing, workCirc, workRatio);
      } else {
        const restRatio = (pomoState.breakSeconds - pomoState.remaining) / pomoState.breakSeconds;
        setRingProgress(pomoRestRing, restCirc, restRatio);
      }
    }
  });
  pomoReset.addEventListener("click", () => {
    stopRepeatingAlarm();
    pomoState.running = false;
    setPomoFromInput();
  });

  if (stopAlarmBtn) {
    stopAlarmBtn.addEventListener("click", stopRepeatingAlarm);
  }

  const handleBeforeUnload = (event) => {
    if (timerIsActive()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };

  const handleVisibilityChange = () => {
    if (!timerIsActive()) {
      window.sessionStorage.removeItem("focused-timer-return");
      return;
    }

    if (document.visibilityState === "hidden") {
      window.sessionStorage.setItem("focused-timer-return", "1");
      return;
    }

    if (document.visibilityState === "visible" && window.sessionStorage.getItem("focused-timer-return")) {
      showTimerNotice("Welcome back. Your timer is still running — let’s gently return to focus.");
      window.sessionStorage.removeItem("focused-timer-return");
    }
  };

  const handlePageLinkClick = (event) => {
    const link = event.target.closest("a[href]");
    if (!link || !timerIsActive()) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;

    const targetUrl = new URL(link.href, window.location.origin);
    const currentUrl = new URL(window.location.href);

    if (
      targetUrl.pathname === currentUrl.pathname &&
      targetUrl.search === currentUrl.search &&
      targetUrl.hash === currentUrl.hash
    ) {
      return;
    }

    const shouldLeave = window.confirm(
      "Your timer is still running. Do you want to leave this screen and keep the timer going?"
    );

    if (!shouldLeave) {
      event.preventDefault();
      showTimerNotice("You stayed on the timer. Nice — let’s keep going.");
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("click", handlePageLinkClick, true);
  window.addEventListener("pagehide", () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("click", handlePageLinkClick, true);
    stopRepeatingAlarm();
    window.clearInterval(ticker);
  });

  renderMode();
};

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".bottom-nav .nav-btn");
  const current = window.location.pathname;
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href === current || (href === "/calendar" && current === "/calendar-grid")) {
      link.classList.add("active");
    }
  });
  loadHome();
  loadTaskDetail();
  loadCalendar();
  loadCalendarGrid();
  loadTimerPage();

  const addTaskForm = document.getElementById("addTaskForm");
  const subtaskArea = document.getElementById("subtaskArea");
  const breakdownBtn = document.getElementById("breakdownBtn");
  const aiLoading = document.getElementById("aiLoading");
  const aiResult = document.getElementById("aiResult");
  const aiSubtasks = document.getElementById("aiSubtasks");
  const aiTaskTitle = document.getElementById("aiTaskTitle");
  const aiCancelLoading = document.getElementById("aiCancelLoading");
  const aiCancelResult = document.getElementById("aiCancelResult");
  const aiDone = document.getElementById("aiDone");
  let aiDraftSubtasks = [];
  let aiDraftPage = 0;

  if (subtaskArea) {
    const ensureTrailingInput = () => {
      const inputs = Array.from(subtaskArea.querySelectorAll("input[name=\"subtask\"]"));
      if (!inputs.length || inputs[inputs.length - 1].value.trim() !== "") {
        const wrapper = document.createElement("label");
        wrapper.className = "line-field";
        wrapper.innerHTML = `
          <span>Add sub task (optional)</span>
          <input type="text" name="subtask" placeholder="" />
        `;
        subtaskArea.appendChild(wrapper);
      }
    };

    const addSubtaskValue = (value) => {
      const inputs = Array.from(subtaskArea.querySelectorAll("input[name=\"subtask\"]"));
      const empty = inputs.find((input) => !input.value.trim());
      if (empty) {
        empty.value = value;
      } else {
        const wrapper = document.createElement("label");
        wrapper.className = "line-field";
        wrapper.innerHTML = `
          <span>Add sub task (optional)</span>
          <input type="text" name="subtask" placeholder="" value="${value.replace(/"/g, "&quot;")}" />
        `;
        subtaskArea.appendChild(wrapper);
      }
      ensureTrailingInput();
    };

    subtaskArea.addEventListener("input", (event) => {
      if (event.target.matches("input[name=\"subtask\"]")) {
        ensureTrailingInput();
      }
    });

    ensureTrailingInput();
    subtaskArea.addSubtaskValue = addSubtaskValue;
  }

  if (addTaskForm) {
    addTaskForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(addTaskForm);
      const title = (formData.get("title") || "").toString().trim();
      if (!title) return;
      const dueDate = formData.get("due_date") || null;
      const category = formData.get("category") || null;
      const subtasks = Array.from(addTaskForm.querySelectorAll("input[name=\"subtask\"]"))
        .map((input) => input.value.trim())
        .filter(Boolean);

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, due_date: dueDate, category, subtasks }),
      });

      if (res.ok) {
        window.location.href = "/home";
      }
    });
  }

  const showAiLoading = () => {
    if (!aiLoading || !aiResult) return;
    aiResult.classList.add("hidden");
    aiLoading.classList.remove("hidden");
  };

  const showAiResult = (title, subtasks) => {
    if (!aiResult || !aiSubtasks || !aiTaskTitle) return;
    aiTaskTitle.textContent = title || "Task";
    const perPage = 4;
    aiDraftPage = 0;
    aiDraftSubtasks = subtasks
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    const saveVisiblePage = () => {
      const rows = Array.from(aiSubtasks.querySelectorAll(".ai-subtask-row[data-index]"));
      rows.forEach((row) => {
        const index = Number(row.dataset.index);
        const input = row.querySelector("textarea");
        if (!Number.isNaN(index) && input) {
          aiDraftSubtasks[index] = input.value.trim();
        }
      });
      aiDraftSubtasks = aiDraftSubtasks.filter(Boolean);
    };

    const renderPage = () => {
      aiSubtasks.innerHTML = "";
      const start = aiDraftPage * perPage;
      const slice = aiDraftSubtasks.slice(start, start + perPage);

      slice.forEach((text, idx) => {
        const row = document.createElement("div");
        row.className = "ai-subtask-row";
        row.dataset.index = String(start + idx);
        row.innerHTML = `
          <textarea readonly rows="1">${escapeHtml(text)}</textarea>
          <button type="button" class="ai-edit" aria-label="Edit">✎</button>
        `;
        const input = row.querySelector("textarea");
        const editBtn = row.querySelector(".ai-edit");
        autoResizeTextarea(input);
        editBtn.addEventListener("click", () => {
          input.removeAttribute("readonly");
          input.focus();
        });
        input.addEventListener("input", () => autoResizeTextarea(input));
        input.addEventListener("blur", () => {
          const value = input.value.trim();
          aiDraftSubtasks[start + idx] = value;
          input.setAttribute("readonly", "readonly");
          autoResizeTextarea(input);
        });
        aiSubtasks.appendChild(row);
      });

      const addRow = document.createElement("div");
      addRow.className = "ai-subtask-row";
      addRow.innerHTML = `<textarea rows="1" placeholder="Add subtask"></textarea>`;
      const addField = addRow.querySelector("textarea");
      autoResizeTextarea(addField);
      addField.addEventListener("input", () => autoResizeTextarea(addField));
      addField.addEventListener("blur", (event) => {
        const value = event.target.value.trim();
        if (value) {
          saveVisiblePage();
          aiDraftSubtasks.push(value);
          renderPage();
        }
      });
      aiSubtasks.appendChild(addRow);

      if (aiDraftSubtasks.length > perPage) {
        const prev = document.createElement("button");
        prev.className = "ai-nav prev";
        prev.type = "button";
        prev.textContent = "‹";
        prev.addEventListener("click", () => {
          saveVisiblePage();
          aiDraftPage = Math.max(0, aiDraftPage - 1);
          renderPage();
        });

        const next = document.createElement("button");
        next.className = "ai-nav next";
        next.type = "button";
        next.textContent = "›";
        next.addEventListener("click", () => {
          saveVisiblePage();
          aiDraftPage = Math.min(Math.floor((aiDraftSubtasks.length - 1) / perPage), aiDraftPage + 1);
          renderPage();
        });

        aiSubtasks.appendChild(prev);
        aiSubtasks.appendChild(next);
      }
    };

    renderPage();

    aiLoading.classList.add("hidden");
    aiResult.classList.remove("hidden");
  };

  const closeAiFlow = () => {
    if (!aiLoading || !aiResult) return;
    aiLoading.classList.add("hidden");
    aiResult.classList.add("hidden");
  };

  if (aiCancelLoading) aiCancelLoading.addEventListener("click", closeAiFlow);
  if (aiCancelResult) aiCancelResult.addEventListener("click", closeAiFlow);

  if (aiDone) {
    aiDone.addEventListener("click", () => {
      if (!subtaskArea || !subtaskArea.addSubtaskValue) return;
      const rows = Array.from(aiSubtasks.querySelectorAll(".ai-subtask-row[data-index]"));
      rows.forEach((row) => {
        const index = Number(row.dataset.index);
        const input = row.querySelector("textarea");
        if (!Number.isNaN(index) && input) {
          aiDraftSubtasks[index] = input.value.trim();
        }
      });
      aiDraftSubtasks
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => subtaskArea.addSubtaskValue(value));
      closeAiFlow();
    });
  }

  if (breakdownBtn) {
    breakdownBtn.addEventListener("click", async () => {
      const titleInput = document.querySelector("input[name=\"title\"]");
      const title = titleInput ? titleInput.value.trim() : "";
      if (!title) return;
      showAiLoading();
      const res = await fetch("/api/suggest-subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        let message = "AI breakdown failed. Check server/API key.";
        try {
          const err = await res.json();
          if (err && err.error) message = err.error;
        } catch (e) {}
        alert(message);
        closeAiFlow();
        return;
      }
      const data = await res.json();
      const list = data.subtasks || [];
      showAiResult(title, list);
    });
  }
});
