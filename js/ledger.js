/**
 * ledger.js - Subscription Ledger Management
 * Handles table & card views, search, category/cycle filters, sorting, CRUD modal interactions, and preset auto-fill.
 */

class LedgerManager {
  constructor() {
    this.searchQuery = '';
    this.filterCategory = 'all';
    this.filterCycle = 'all';
    this.filterStatus = 'all';
    this.filterUsage = 'all';
    this.sortBy = 'renewal-asc'; // 'renewal-asc', 'cost-desc', 'cost-asc', 'name-asc', 'usage-asc'
    this.viewLayout = 'table'; // 'table' or 'grid'
    this.editingId = null;
  }

  init() {
    this.bindEvents();
    this.renderPresetPills();
    this.render();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('ledger-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Filters
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.filterCategory = e.target.value;
        this.render();
      });
    }

    const cycleSelect = document.getElementById('filter-cycle');
    if (cycleSelect) {
      cycleSelect.addEventListener('change', (e) => {
        this.filterCycle = e.target.value;
        this.render();
      });
    }

    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.filterStatus = e.target.value;
        this.render();
      });
    }

    const usageSelect = document.getElementById('filter-usage');
    if (usageSelect) {
      usageSelect.addEventListener('change', (e) => {
        this.filterUsage = e.target.value;
        this.render();
      });
    }

    const sortSelect = document.getElementById('ledger-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });
    }

    // Table vs Grid View Toggle
    const tableViewBtn = document.getElementById('layout-toggle-table');
    const gridViewBtn = document.getElementById('layout-toggle-grid');
    if (tableViewBtn && gridViewBtn) {
      tableViewBtn.addEventListener('click', () => {
        this.viewLayout = 'table';
        tableViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        document.getElementById('ledger-table-container').style.display = 'block';
        document.getElementById('ledger-grid-container').style.display = 'none';
        this.render();
      });

      gridViewBtn.addEventListener('click', () => {
        this.viewLayout = 'grid';
        gridViewBtn.classList.add('active');
        tableViewBtn.classList.remove('active');
        document.getElementById('ledger-table-container').style.display = 'none';
        document.getElementById('ledger-grid-container').style.display = 'grid';
        this.render();
      });
    }

    // Add Subscription Buttons
    const openAddBtn = document.getElementById('btn-open-add-modal');
    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => this.openAddModal());
    }

    // Form submit
    const subForm = document.getElementById('subscription-form');
    if (subForm) {
      subForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Modal Close buttons
    document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
      });
    });

    // Star rating picker in form
    const starPicker = document.getElementById('form-star-picker');
    if (starPicker) {
      starPicker.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.getAttribute('data-value'), 10);
          document.getElementById('form-usage-score').value = val;
          this.updateStarPickerVisual(val);
        });
      });
    }
  }

  updateStarPickerVisual(val) {
    const starPicker = document.getElementById('form-star-picker');
    if (!starPicker) return;
    starPicker.querySelectorAll('.star-btn').forEach(btn => {
      const bVal = parseInt(btn.getAttribute('data-value'), 10);
      if (bVal <= val) {
        btn.classList.add('filled');
      } else {
        btn.classList.remove('filled');
      }
    });
  }

  renderPresetPills() {
    const container = document.getElementById('preset-pills-list');
    if (!container) return;

    container.innerHTML = '';
    PRESET_CATALOG.forEach(preset => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'preset-pill';
      pill.innerHTML = `
        <span class="preset-pill-dot" style="background-color: ${preset.color}"></span>
        <span class="preset-pill-name">${preset.name}</span>
        <span class="preset-pill-cost">$${preset.cost.toFixed(0)}</span>
      `;
      pill.addEventListener('click', () => {
        this.fillFormWithPreset(preset);
      });
      container.appendChild(pill);
    });
  }

  fillFormWithPreset(preset) {
    document.getElementById('form-name').value = preset.name;
    document.getElementById('form-cost').value = preset.cost;
    document.getElementById('form-category').value = preset.category;
    document.getElementById('form-billing-cycle').value = preset.billingCycle;
    document.getElementById('form-cancel-url').value = preset.cancelUrl || '';
    if (!document.getElementById('form-renewal-date').value) {
      document.getElementById('form-renewal-date').value = window.storageManager.formatOffsetDate(14);
    }
    // Highlighting
    const input = document.getElementById('form-cost');
    input.focus();
    input.select();
  }

  getFilteredList() {
    const all = window.storageManager.getSubscriptions();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return all.filter(sub => {
      // Search
      if (this.searchQuery) {
        const matchesName = sub.name.toLowerCase().includes(this.searchQuery);
        const matchesCategory = sub.category.toLowerCase().includes(this.searchQuery);
        const matchesPM = (sub.paymentMethod || '').toLowerCase().includes(this.searchQuery);
        const matchesNotes = (sub.notes || '').toLowerCase().includes(this.searchQuery);
        if (!matchesName && !matchesCategory && !matchesPM && !matchesNotes) return false;
      }

      // Category
      if (this.filterCategory !== 'all' && sub.category !== this.filterCategory) {
        return false;
      }

      // Cycle
      if (this.filterCycle !== 'all' && sub.billingCycle !== this.filterCycle) {
        return false;
      }

      // Status
      if (this.filterStatus !== 'all' && sub.status !== this.filterStatus) {
        return false;
      }

      // Usage
      if (this.filterUsage === 'vampire' && (sub.usageScore > 2 && sub.status !== 'To Cancel')) {
        return false;
      }
      if (this.filterUsage === 'high' && sub.usageScore < 4) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (this.sortBy === 'cost-desc') {
        const mA = this.getMonthlyEquivalent(a);
        const mB = this.getMonthlyEquivalent(b);
        return mB - mA;
      } else if (this.sortBy === 'cost-asc') {
        const mA = this.getMonthlyEquivalent(a);
        const mB = this.getMonthlyEquivalent(b);
        return mA - mB;
      } else if (this.sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (this.sortBy === 'usage-asc') {
        return (a.usageScore || 3) - (b.usageScore || 3);
      } else {
        // renewal-asc
        const dateA = new Date(a.renewalDate + 'T00:00:00');
        const dateB = new Date(b.renewalDate + 'T00:00:00');
        return dateA - dateB;
      }
    });
  }

  getMonthlyEquivalent(sub) {
    if (sub.billingCycle === 'Yearly') return sub.cost / 12;
    if (sub.billingCycle === 'Quarterly') return sub.cost / 3;
    if (sub.billingCycle === 'Weekly') return sub.cost * 4.33;
    return sub.cost;
  }

  render() {
    const list = this.getFilteredList();
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    // Update counter
    const countBadge = document.getElementById('ledger-total-count');
    if (countBadge) countBadge.textContent = `${list.length} subscriptions`;

    if (this.viewLayout === 'table') {
      this.renderTable(list, currency);
    } else {
      this.renderGrid(list, currency);
    }

    // Refresh KPI header metrics
    this.updateHeaderKPIs();
  }

  updateHeaderKPIs() {
    const all = window.storageManager.getSubscriptions();
    const active = all.filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    let totalMonthly = 0;
    let vampireMonthlySavings = 0;
    let vampireCount = 0;

    active.forEach(s => {
      const monthly = this.getMonthlyEquivalent(s);
      totalMonthly += monthly;

      if ((s.usageScore <= 2 || s.status === 'To Cancel') && s.status !== 'Paused') {
        vampireMonthlySavings += monthly;
        vampireCount++;
      }
    });

    const mrrEl = document.getElementById('kpi-mrr-value');
    const annualEl = document.getElementById('kpi-annual-value');
    const activeSubsEl = document.getElementById('kpi-active-subs-count');
    const vampireWasteEl = document.getElementById('kpi-vampire-waste');
    const vampireCountEl = document.getElementById('kpi-vampire-count');

    if (mrrEl) mrrEl.textContent = `${currency}${totalMonthly.toFixed(2)}`;
    if (annualEl) annualEl.textContent = `${currency}${(totalMonthly * 12).toFixed(2)}`;
    if (activeSubsEl) activeSubsEl.textContent = `${active.length}`;
    if (vampireWasteEl) vampireWasteEl.textContent = `${currency}${vampireMonthlySavings.toFixed(2)}/mo`;
    if (vampireCountEl) vampireCountEl.textContent = `${vampireCount} services`;

    // Also update alert bell banner if renewals are imminent
    if (window.alertManager) {
      window.alertManager.checkImminentRenewals();
    }
  }

  renderTable(list, currency) {
    const tbody = document.getElementById('ledger-tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8">
            <div class="empty-state">
              <p>No subscriptions match your current search or filters.</p>
              <button class="btn btn-sm btn-outline mt-3" onclick="window.ledgerManager.resetFilters()">Clear Filters</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tbody.innerHTML = list.map(sub => {
      const renewalDate = new Date(sub.renewalDate + 'T00:00:00');
      const diffDays = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

      let renewalBadge = '';
      if (diffDays < 0) {
        renewalBadge = `<span class="badge badge-neutral">Past (${Math.abs(diffDays)}d ago)</span>`;
      } else if (diffDays === 0) {
        renewalBadge = `<span class="badge badge-urgent animate-pulse">⚡ Today</span>`;
      } else if (diffDays <= 3) {
        renewalBadge = `<span class="badge badge-urgent">⏳ In ${diffDays} days</span>`;
      } else if (diffDays <= 7) {
        renewalBadge = `<span class="badge badge-soon">In ${diffDays} days</span>`;
      } else {
        renewalBadge = `<span class="badge badge-neutral">${sub.renewalDate}</span>`;
      }

      let statusBadge = '';
      if (sub.status === 'Active') {
        statusBadge = `<span class="status-pill status-active">Active</span>`;
      } else if (sub.status === 'Trial') {
        statusBadge = `<span class="status-pill status-trial">Trial</span>`;
      } else if (sub.status === 'Paused') {
        statusBadge = `<span class="status-pill status-paused">Paused</span>`;
      } else if (sub.status === 'To Cancel') {
        statusBadge = `<span class="status-pill status-cancel">To Cancel</span>`;
      }

      const usageStars = this.renderStarRating(sub.usageScore || 3);
      const isVampire = (sub.usageScore <= 2 || sub.status === 'To Cancel') && sub.status !== 'Paused';

      return `
        <tr class="ledger-row ${isVampire ? 'row-vampire-flag' : ''}">
          <td class="col-service">
            <div class="service-cell">
              <div class="service-avatar ${this.getCategoryAvatarClass(sub.category)}">
                ${this.escapeHTML(sub.name.charAt(0))}
              </div>
              <div class="service-text">
                <div class="service-name-row">
                  <span class="service-name">${this.escapeHTML(sub.name)}</span>
                  ${isVampire ? `<span class="badge badge-warning" title="Vampire Spend: Low usage rating (${sub.usageScore}★). Consider cancelling to save money!">🧛 Vampire</span>` : ''}
                </div>
                ${sub.notes ? `<span class="service-notes" title="${this.escapeHTML(sub.notes)}">${this.escapeHTML(sub.notes)}</span>` : ''}
              </div>
            </div>
          </td>
          <td class="col-category">
            <span class="category-pill">${sub.category}</span>
          </td>
          <td class="col-cost">
            <div class="cost-cell">
              <span class="cost-amount">${currency}${sub.cost.toFixed(2)}</span>
              <span class="cost-cycle">/${sub.billingCycle.toLowerCase()}</span>
            </div>
          </td>
          <td class="col-renewal">
            <div class="renewal-cell">
              <span class="renewal-date">${sub.renewalDate}</span>
              ${renewalBadge}
            </div>
          </td>
          <td class="col-pm">
            <span class="pm-text"><i class="icon-card"></i> ${this.escapeHTML(sub.paymentMethod || 'Credit Card')}</span>
          </td>
          <td class="col-usage" title="Usage score: ${sub.usageScore || 3}/5 stars">
            <div class="usage-stars-display">${usageStars}</div>
          </td>
          <td class="col-status">
            ${statusBadge}
          </td>
          <td class="col-actions">
            <div class="actions-cell">
              <button class="btn-icon" title="Trigger Email Alert / Preview Notification" onclick="window.alertManager.previewEmailAlert('${sub.id}')">
                ✉️
              </button>
              ${sub.cancellationUrl ? `
                <a href="${sub.cancellationUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="Direct Cancellation Link">
                  🔗
                </a>
              ` : ''}
              <button class="btn-icon" title="Edit Subscription" onclick="window.ledgerManager.openEditModal('${sub.id}')">
                ✏️
              </button>
              <button class="btn-icon btn-icon-danger" title="Delete Subscription" onclick="window.ledgerManager.confirmDelete('${sub.id}')">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderGrid(list, currency) {
    const grid = document.getElementById('ledger-grid-container');
    if (!grid) return;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>No subscriptions match your current search or filters.</p>
        </div>
      `;
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    grid.innerHTML = list.map(sub => {
      const renewalDate = new Date(sub.renewalDate + 'T00:00:00');
      const diffDays = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
      const isVampire = (sub.usageScore <= 2 || sub.status === 'To Cancel') && sub.status !== 'Paused';

      return `
        <div class="sub-card ${isVampire ? 'card-vampire' : ''}">
          <div class="card-top">
            <div class="card-service-header">
              <div class="service-avatar ${this.getCategoryAvatarClass(sub.category)}">
                ${this.escapeHTML(sub.name.charAt(0))}
              </div>
              <div>
                <h4 class="card-title">${this.escapeHTML(sub.name)}</h4>
                <span class="category-pill">${sub.category}</span>
              </div>
            </div>
            <div class="card-cost-badge">
              <span class="card-cost">${currency}${sub.cost.toFixed(2)}</span>
              <span class="card-cycle">/${sub.billingCycle.toLowerCase()}</span>
            </div>
          </div>

          <div class="card-details">
            <div class="card-detail-row">
              <span class="c-label">Next Bill:</span>
              <span class="c-val"><strong>${sub.renewalDate}</strong> (in ${diffDays}d)</span>
            </div>
            <div class="card-detail-row">
              <span class="c-label">Payment:</span>
              <span class="c-val">${this.escapeHTML(sub.paymentMethod || 'Credit Card')}</span>
            </div>
            <div class="card-detail-row">
              <span class="c-label">Usage:</span>
              <span class="c-val">${this.renderStarRating(sub.usageScore || 3)}</span>
            </div>
            ${sub.notes ? `
              <div class="card-notes">${this.escapeHTML(sub.notes)}</div>
            ` : ''}
          </div>

          <div class="card-footer">
            <div class="card-status-pill">${sub.status}</div>
            <div class="card-actions">
              <button class="btn btn-xs btn-outline" onclick="window.alertManager.previewEmailAlert('${sub.id}')">✉️ Alert</button>
              ${sub.cancellationUrl ? `<a href="${sub.cancellationUrl}" target="_blank" class="btn btn-xs btn-ghost">🔗 Cancel</a>` : ''}
              <button class="btn btn-xs btn-ghost" onclick="window.ledgerManager.openEditModal('${sub.id}')">✏️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderStarRating(score) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star-icon ${i <= score ? 'star-filled' : 'star-empty'}">★</span>`;
    }
    return html;
  }

  getCategoryAvatarClass(cat) {
    switch (cat) {
      case 'Entertainment': return 'avatar-entertainment';
      case 'Productivity': return 'avatar-productivity';
      case 'Developer Tools': return 'avatar-dev';
      case 'Health & Fitness': return 'avatar-health';
      case 'Utilities & Cloud': return 'avatar-cloud';
      case 'Food & Lifestyle': return 'avatar-food';
      default: return 'avatar-default';
    }
  }

  resetFilters() {
    this.searchQuery = '';
    this.filterCategory = 'all';
    this.filterCycle = 'all';
    this.filterStatus = 'all';
    this.filterUsage = 'all';
    
    document.getElementById('ledger-search').value = '';
    document.getElementById('filter-category').value = 'all';
    document.getElementById('filter-cycle').value = 'all';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-usage').value = 'all';

    this.render();
  }

  openAddModal(prefill = {}) {
    this.editingId = null;
    const modal = document.getElementById('subscription-modal');
    const title = document.getElementById('modal-sub-title');
    const form = document.getElementById('subscription-form');
    if (!modal || !form) return;

    title.textContent = 'Add New Subscription';
    form.reset();

    // Default values
    document.getElementById('form-renewal-date').value = prefill.renewalDate || window.storageManager.formatOffsetDate(14);
    document.getElementById('form-usage-score').value = 4;
    document.getElementById('form-billing-cycle').value = 'Monthly';
    document.getElementById('form-status').value = 'Active';
    document.getElementById('form-pm').value = 'Chase Sapphire ··4821';
    this.updateStarPickerVisual(4);

    modal.classList.add('active');
    document.getElementById('form-name').focus();
  }

  openEditModal(id) {
    this.editingId = id;
    const sub = window.storageManager.getSubscriptions().find(s => s.id === id);
    if (!sub) return;

    const modal = document.getElementById('subscription-modal');
    const title = document.getElementById('modal-sub-title');
    if (!modal) return;

    title.textContent = `Edit Subscription - ${sub.name}`;

    document.getElementById('form-name').value = sub.name;
    document.getElementById('form-cost').value = sub.cost;
    document.getElementById('form-category').value = sub.category;
    document.getElementById('form-billing-cycle').value = sub.billingCycle;
    document.getElementById('form-renewal-date').value = sub.renewalDate;
    document.getElementById('form-pm').value = sub.paymentMethod || '';
    document.getElementById('form-status').value = sub.status || 'Active';
    document.getElementById('form-usage-score').value = sub.usageScore || 3;
    document.getElementById('form-cancel-url').value = sub.cancellationUrl || '';
    document.getElementById('form-notes').value = sub.notes || '';
    
    this.updateStarPickerVisual(sub.usageScore || 3);

    modal.classList.add('active');
  }

  handleFormSubmit() {
    const name = document.getElementById('form-name').value.trim();
    const cost = parseFloat(document.getElementById('form-cost').value) || 0;
    const category = document.getElementById('form-category').value;
    const billingCycle = document.getElementById('form-billing-cycle').value;
    const renewalDate = document.getElementById('form-renewal-date').value;
    const paymentMethod = document.getElementById('form-pm').value.trim();
    const status = document.getElementById('form-status').value;
    const usageScore = parseInt(document.getElementById('form-usage-score').value, 10) || 3;
    const cancellationUrl = document.getElementById('form-cancel-url').value.trim();
    const notes = document.getElementById('form-notes').value.trim();

    if (!name || cost <= 0 || !renewalDate) {
      window.app.showToast('Please fill in valid service name, cost, and renewal date.', 'warning');
      return;
    }

    const payload = {
      name,
      cost,
      category,
      billingCycle,
      renewalDate,
      paymentMethod,
      status,
      usageScore,
      cancellationUrl,
      notes,
      alertDaysBefore: 3
    };

    if (this.editingId) {
      window.storageManager.updateSubscription(this.editingId, payload);
      window.app.showToast(`Updated "${name}" successfully.`, 'success');
    } else {
      window.storageManager.addSubscription(payload);
      window.app.showToast(`Added "${name}" to your ledger.`, 'success');
    }

    // Close modal & rerender
    document.getElementById('subscription-modal').classList.remove('active');
    this.render();
    if (window.calendarManager) window.calendarManager.render();
    if (window.analyticsManager) window.analyticsManager.render();
  }

  confirmDelete(id) {
    const sub = window.storageManager.getSubscriptions().find(s => s.id === id);
    if (!sub) return;

    if (confirm(`Are you sure you want to remove "${sub.name}" from your recurring ledger?`)) {
      window.storageManager.deleteSubscription(id);
      window.app.showToast(`Removed "${sub.name}".`, 'info');
      this.render();
      if (window.calendarManager) window.calendarManager.render();
      if (window.analyticsManager) window.analyticsManager.render();
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.ledgerManager = new LedgerManager();
