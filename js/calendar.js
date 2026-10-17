/**
 * calendar.js - Visual Renewal Calendar & Chronological Timeline View
 * Handles monthly grid rendering, date math, day inspection, and visual upcoming timeline.
 */

class CalendarManager {
  constructor() {
    this.currentDate = new Date(); // Represents viewed month/year in calendar
    this.selectedDay = null;
    this.activeMode = 'calendar'; // 'calendar' or 'timeline'
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    const todayBtn = document.getElementById('cal-today-btn');
    const calViewToggle = document.getElementById('view-toggle-calendar');
    const timelineViewToggle = document.getElementById('view-toggle-timeline');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.currentDate = new Date();
        this.render();
      });
    }

    if (calViewToggle && timelineViewToggle) {
      calViewToggle.addEventListener('click', () => {
        this.activeMode = 'calendar';
        calViewToggle.classList.add('active');
        timelineViewToggle.classList.remove('active');
        document.getElementById('calendar-grid-wrapper').style.display = 'block';
        document.getElementById('timeline-list-wrapper').style.display = 'none';
        this.render();
      });

      timelineViewToggle.addEventListener('click', () => {
        this.activeMode = 'timeline';
        timelineViewToggle.classList.add('active');
        calViewToggle.classList.remove('active');
        document.getElementById('calendar-grid-wrapper').style.display = 'none';
        document.getElementById('timeline-list-wrapper').style.display = 'block';
        this.renderTimeline();
      });
    }
  }

  render() {
    this.renderCalendarMonth();
    this.renderMonthStats();
    if (this.activeMode === 'timeline') {
      this.renderTimeline();
    }
  }

  renderMonthStats() {
    const subs = window.storageManager.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    const viewedYear = this.currentDate.getFullYear();
    const viewedMonth = this.currentDate.getMonth(); // 0-indexed

    // Calculate renewals falling in this viewed month
    let monthRenewalCount = 0;
    let monthTotalOutflow = 0;
    const dailySpend = {};

    subs.forEach(s => {
      const parts = s.renewalDate.split('-');
      const rYear = parseInt(parts[0], 10);
      const rMonth = parseInt(parts[1], 10) - 1;
      const rDay = parseInt(parts[2], 10);

      let isDueThisMonth = false;
      if (s.billingCycle === 'Monthly') {
        // Renews every month on rDay
        isDueThisMonth = true;
      } else if (rYear === viewedYear && rMonth === viewedMonth) {
        // Yearly/one-off match
        isDueThisMonth = true;
      }

      if (isDueThisMonth) {
        monthRenewalCount++;
        monthTotalOutflow += s.cost;
        dailySpend[rDay] = (dailySpend[rDay] || 0) + s.cost;
      }
    });

    let peakDay = '-';
    let peakAmount = 0;
    Object.keys(dailySpend).forEach(d => {
      if (dailySpend[d] > peakAmount) {
        peakAmount = dailySpend[d];
        peakDay = `Day ${d} (${currency}${peakAmount.toFixed(2)})`;
      }
    });

    const statCountEl = document.getElementById('cal-stat-renewals-count');
    const statOutflowEl = document.getElementById('cal-stat-month-outflow');
    const statPeakEl = document.getElementById('cal-stat-peak-day');

    if (statCountEl) statCountEl.textContent = `${monthRenewalCount} charges`;
    if (statOutflowEl) statOutflowEl.textContent = `${currency}${monthTotalOutflow.toFixed(2)}`;
    if (statPeakEl) statPeakEl.textContent = peakDay;
  }

  renderCalendarMonth() {
    const gridEl = document.getElementById('calendar-days-grid');
    const monthTitleEl = document.getElementById('calendar-month-title');
    if (!gridEl || !monthTitleEl) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthTitleEl.textContent = `${monthNames[month]} ${year}`;

    gridEl.innerHTML = '';

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subs = window.storageManager.getSubscriptions();
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    // Map subscriptions to days for this month
    const subsByDay = {};
    subs.forEach(s => {
      if (s.status === 'Paused') return;
      const parts = s.renewalDate.split('-');
      const rYear = parseInt(parts[0], 10);
      const rMonth = parseInt(parts[1], 10) - 1;
      const rDay = parseInt(parts[2], 10);

      let applies = false;
      if (s.billingCycle === 'Monthly') {
        applies = true;
      } else if (rYear === year && rMonth === month) {
        applies = true;
      }

      if (applies && rDay >= 1 && rDay <= daysInMonth) {
        if (!subsByDay[rDay]) subsByDay[rDay] = [];
        subsByDay[rDay].push(s);
      }
    });

    // 1. Fill previous month's trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayNum = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.innerHTML = `<span class="day-num">${prevDayNum}</span>`;
      gridEl.appendChild(cell);
    }

    // 2. Fill current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      cellDate.setHours(0, 0, 0, 0);

      const isToday = cellDate.getTime() === today.getTime();
      const isPast = cellDate < today;
      const daySubs = subsByDay[day] || [];

      const cell = document.createElement('div');
      cell.className = `calendar-day-cell ${isToday ? 'today' : ''} ${isPast ? 'past-day' : ''} ${daySubs.length > 0 ? 'has-renewals' : ''}`;
      cell.setAttribute('data-day', day);
      cell.setAttribute('data-date', `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);

      let dayTotal = 0;
      daySubs.forEach(s => dayTotal += s.cost);

      let chipsHtml = '';
      const displaySubs = daySubs.slice(0, 3);
      displaySubs.forEach(s => {
        chipsHtml += `
          <div class="cal-sub-chip ${s.usageScore <= 2 ? 'chip-vampire' : ''}" title="${s.name} - ${currency}${s.cost.toFixed(2)}">
            <span class="chip-name">${this.escapeHTML(s.name)}</span>
            <span class="chip-cost">${currency}${s.cost.toFixed(0)}</span>
          </div>
        `;
      });

      if (daySubs.length > 3) {
        chipsHtml += `<div class="cal-sub-more">+${daySubs.length - 3} more</div>`;
      }

      cell.innerHTML = `
        <div class="day-cell-header">
          <span class="day-num ${isToday ? 'today-badge' : ''}">${day}</span>
          ${dayTotal > 0 ? `<span class="day-total-badge">${currency}${dayTotal.toFixed(0)}</span>` : ''}
        </div>
        <div class="day-cell-content">
          ${chipsHtml}
        </div>
      `;

      cell.addEventListener('click', () => {
        this.openDayInspector(cellDate, daySubs);
      });

      gridEl.appendChild(cell);
    }

    // 3. Fill next month's leading days to complete the 7-column grid
    const totalRendered = firstDayIndex + daysInMonth;
    const remainingCells = (7 - (totalRendered % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.innerHTML = `<span class="day-num">${day}</span>`;
      gridEl.appendChild(cell);
    }
  }

  renderTimeline() {
    const listEl = document.getElementById('timeline-items-list');
    if (!listEl) return;

    const subs = window.storageManager.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Compute next actual renewal date for each sub
    const timelineItems = subs.map(s => {
      const nextDate = this.calculateNextRenewalDate(s.renewalDate, s.billingCycle);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        ...s,
        computedNextDate: nextDate,
        diffDays
      };
    });

    // Sort by nearest renewal first
    timelineItems.sort((a, b) => a.computedNextDate - b.computedNextDate);

    if (timelineItems.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>No active subscriptions found. Add subscriptions to populate the renewal timeline.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';

    // Grouping
    const groups = [
      { label: '🚨 Renewing in Next 3 Days (Urgent Attention)', filter: item => item.diffDays <= 3 && item.diffDays >= 0, className: 'group-urgent' },
      { label: '📅 Renewing This Week (4 - 7 Days)', filter: item => item.diffDays > 3 && item.diffDays <= 7, className: 'group-soon' },
      { label: '🗓️ Due Later This Month (8 - 30 Days)', filter: item => item.diffDays > 7 && item.diffDays <= 30, className: 'group-month' },
      { label: '⏳ Future Scheduled Renewals (> 30 Days)', filter: item => item.diffDays > 30, className: 'group-future' }
    ];

    groups.forEach(grp => {
      const matched = timelineItems.filter(grp.filter);
      if (matched.length === 0) return;

      const groupHeader = document.createElement('div');
      groupHeader.className = `timeline-group-header ${grp.className}`;
      groupHeader.innerHTML = `<span>${grp.label}</span> <span class="group-count">(${matched.length})</span>`;
      listEl.appendChild(groupHeader);

      matched.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = `timeline-card ${item.diffDays <= 3 ? 'timeline-urgent' : ''} ${item.usageScore <= 2 ? 'timeline-vampire' : ''}`;

        let urgencyBadge = '';
        if (item.diffDays === 0) {
          urgencyBadge = `<span class="badge badge-urgent">⚡ Renews Today</span>`;
        } else if (item.diffDays === 1) {
          urgencyBadge = `<span class="badge badge-urgent">⚠️ Renews Tomorrow</span>`;
        } else if (item.diffDays <= 3) {
          urgencyBadge = `<span class="badge badge-urgent">⏳ In ${item.diffDays} days</span>`;
        } else {
          urgencyBadge = `<span class="badge badge-neutral">In ${item.diffDays} days</span>`;
        }

        const dateStr = item.computedNextDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        itemEl.innerHTML = `
          <div class="timeline-card-left">
            <div class="timeline-date-block">
              <span class="t-month">${item.computedNextDate.toLocaleDateString('en-US', { month: 'short' })}</span>
              <span class="t-day">${item.computedNextDate.getDate()}</span>
            </div>
            <div class="timeline-info">
              <div class="timeline-title-row">
                <span class="timeline-name">${this.escapeHTML(item.name)}</span>
                ${urgencyBadge}
                ${item.usageScore <= 2 ? `<span class="badge badge-warning" title="Usage score ${item.usageScore}/5 - Review subscription to cut unnecessary costs">🧛 Vampire Spend</span>` : ''}
                ${item.status === 'Trial' ? `<span class="badge badge-trial">Free Trial</span>` : ''}
              </div>
              <div class="timeline-meta-row">
                <span class="meta-item"><i class="icon-tag"></i> ${item.category}</span>
                <span class="meta-item"><i class="icon-card"></i> ${this.escapeHTML(item.paymentMethod || 'Credit Card')}</span>
                <span class="meta-item"><i class="icon-calendar"></i> ${dateStr}</span>
              </div>
            </div>
          </div>
          <div class="timeline-card-right">
            <div class="timeline-cost-block">
              <div class="t-cost">${currency}${item.cost.toFixed(2)}</div>
              <div class="t-cycle">${item.billingCycle}</div>
            </div>
            <div class="timeline-actions">
              <button class="btn btn-sm btn-outline btn-trigger-alert" data-id="${item.id}" title="Send test alert / preview notification email">
                ✉️ Trigger Alert
              </button>
              ${item.cancellationUrl ? `
                <a href="${item.cancellationUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost btn-cancel-link" title="Open cancellation page">
                  🔗 Cancel
                </a>
              ` : ''}
            </div>
          </div>
        `;

        // Wire quick trigger alert
        const alertBtn = itemEl.querySelector('.btn-trigger-alert');
        if (alertBtn) {
          alertBtn.addEventListener('click', () => {
            window.alertManager.previewEmailAlert(item.id);
          });
        }

        listEl.appendChild(itemEl);
      });
    });
  }

  calculateNextRenewalDate(baseDateStr, cycle) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = baseDateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    let next = new Date(year, month, day);
    next.setHours(0, 0, 0, 0);

    // If next is in the future, return it
    if (next >= today) return next;

    // Roll forward based on cycle
    if (cycle === 'Monthly') {
      while (next < today) {
        next.setMonth(next.getMonth() + 1);
      }
    } else if (cycle === 'Yearly') {
      while (next < today) {
        next.setFullYear(next.getFullYear() + 1);
      }
    } else if (cycle === 'Quarterly') {
      while (next < today) {
        next.setMonth(next.getMonth() + 3);
      }
    } else if (cycle === 'Weekly') {
      while (next < today) {
        next.setDate(next.getDate() + 7);
      }
    }

    return next;
  }

  openDayInspector(dateObj, daySubs) {
    const modalEl = document.getElementById('day-inspector-modal');
    const modalTitle = document.getElementById('day-inspector-title');
    const modalContent = document.getElementById('day-inspector-content');
    if (!modalEl || !modalTitle || !modalContent) return;

    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    modalTitle.textContent = `Renewals on ${formattedDate}`;

    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    if (daySubs.length === 0) {
      modalContent.innerHTML = `
        <div class="empty-state">
          <p>No subscriptions are scheduled to renew on this day.</p>
          <button class="btn btn-primary btn-sm" id="day-inspector-add-btn">+ Add Renewal on this Date</button>
        </div>
      `;
      const addBtn = document.getElementById('day-inspector-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          modalEl.classList.remove('active');
          const dateStr = dateObj.toISOString().split('T')[0];
          window.ledgerManager.openAddModal({ renewalDate: dateStr });
        });
      }
    } else {
      let total = 0;
      daySubs.forEach(s => total += s.cost);

      let listHtml = `
        <div class="inspector-summary-bar">
          <span><strong>${daySubs.length}</strong> subscription(s) renewing</span>
          <span class="inspector-total">Total Outflow: <strong>${currency}${total.toFixed(2)}</strong></span>
        </div>
        <div class="inspector-items-list">
      `;

      daySubs.forEach(s => {
        listHtml += `
          <div class="inspector-item">
            <div class="inspector-item-main">
              <div class="inspector-item-name">${this.escapeHTML(s.name)}</div>
              <div class="inspector-item-meta">
                <span>${s.category}</span> • <span>${s.billingCycle}</span> • <span>${this.escapeHTML(s.paymentMethod || 'Credit Card')}</span>
              </div>
            </div>
            <div class="inspector-item-cost">
              <span class="cost-val">${currency}${s.cost.toFixed(2)}</span>
              <div class="inspector-item-btns">
                <button class="btn btn-xs btn-outline inspector-alert-btn" data-id="${s.id}">✉️ Alert</button>
                <button class="btn btn-xs btn-ghost inspector-edit-btn" data-id="${s.id}">✏️ Edit</button>
              </div>
            </div>
          </div>
        `;
      });

      listHtml += '</div>';
      modalContent.innerHTML = listHtml;

      // Bind buttons in inspector
      modalContent.querySelectorAll('.inspector-alert-btn').forEach(b => {
        b.addEventListener('click', () => {
          modalEl.classList.remove('active');
          window.alertManager.previewEmailAlert(b.getAttribute('data-id'));
        });
      });

      modalContent.querySelectorAll('.inspector-edit-btn').forEach(b => {
        b.addEventListener('click', () => {
          modalEl.classList.remove('active');
          window.ledgerManager.openEditModal(b.getAttribute('data-id'));
        });
      });
    }

    modalEl.classList.add('active');
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.calendarManager = new CalendarManager();
