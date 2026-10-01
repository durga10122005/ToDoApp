/**
 * Calendar View Renderer
 * Month view calendar with task placement on dates
 */
import { state } from '../state.js';

let currentCalDate = new Date();

export function renderCalendarView(container) {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const tasks = state.getFilteredTasks();

  // Create date lookup map: 'YYYY-MM-DD' => [tasks]
  const tasksByDate = {};
  tasks.forEach(task => {
    if (task.dueDate) {
      const dKey = task.dueDate.slice(0, 10);
      if (!tasksByDate[dKey]) tasksByDate[dKey] = [];
      tasksByDate[dKey].push(task);
    }
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <div class="calendar-title-wrap">
          <span class="calendar-month-title">${monthNames[month]} ${year}</span>
        </div>
        <div class="calendar-nav-group">
          <button id="cal-today-btn" class="btn-header" style="height:28px;">Today</button>
          <button id="cal-prev-btn" class="calendar-nav-btn" title="Previous Month">‹</button>
          <button id="cal-next-btn" class="calendar-nav-btn" title="Next Month">›</button>
        </div>
      </div>

      <div class="calendar-weekdays">
        <div class="calendar-weekday">Sun</div>
        <div class="calendar-weekday">Mon</div>
        <div class="calendar-weekday">Tue</div>
        <div class="calendar-weekday">Wed</div>
        <div class="calendar-weekday">Thu</div>
        <div class="calendar-weekday">Fri</div>
        <div class="calendar-weekday">Sat</div>
      </div>

      <div class="calendar-grid">
  `;

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateKey = prevDate.toISOString().slice(0, 10);
    html += renderDayCell(dayNum, dateKey, true, false, tasksByDate[dateKey] || []);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    // ensure local ISO string format YYYY-MM-DD
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateKey === todayStr;
    html += renderDayCell(d, dateKey, false, isToday, tasksByDate[dateKey] || []);
  }

  // Next month leading days to complete the 35 or 42 grid cells
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const remaining = totalCells - (firstDay + daysInMonth);
  for (let nextDay = 1; nextDay <= remaining; nextDay++) {
    const nextDate = new Date(year, month + 1, nextDay);
    const dateKey = nextDate.toISOString().slice(0, 10);
    html += renderDayCell(nextDay, dateKey, true, false, tasksByDate[dateKey] || []);
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  bindCalendarEvents(container);
}

function renderDayCell(dayNum, dateKey, isOtherMonth, isToday, dayTasks) {
  return `
    <div class="calendar-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}" data-date="${dateKey}">
      <div class="day-header">
        <span class="day-number">${dayNum}</span>
        <span class="day-add-hint">+ Add</span>
      </div>
      <div class="day-tasks-list">
        ${dayTasks.map(t => `
          <div class="calendar-task-pill ${t.status === 'done' ? 'completed' : ''}" data-task-id="${t.id}" title="${escapeHtml(t.title)}">
            ${t.priority && t.priority !== 'p4' ? `<span class="priority-dot ${t.priority}" style="width:5px;height:5px;"></span>` : ''}
            <span class="calendar-task-pill-title">${escapeHtml(t.title)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function bindCalendarEvents(container) {
  // Month navigation
  document.getElementById('cal-prev-btn')?.addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    renderCalendarView(container);
  });

  document.getElementById('cal-next-btn')?.addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    renderCalendarView(container);
  });

  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    currentCalDate = new Date();
    renderCalendarView(container);
  });

  // Clicking a date cell triggers quick add with that date pre-selected
  container.querySelectorAll('.calendar-day-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.calendar-task-pill')) return;
      const date = cell.getAttribute('data-date');
      document.dispatchEvent(new CustomEvent('TRIGGER_QUICK_ADD_DATE', { detail: { date } }));
    });
  });

  // Clicking a task pill opens task drawer
  container.querySelectorAll('.calendar-task-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = pill.getAttribute('data-task-id');
      state.notify('OPEN_TASK_DRAWER', taskId);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
