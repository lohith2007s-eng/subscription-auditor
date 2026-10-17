/**
 * analytics.js - Financial Analytics & Vampire Spend Auditor
 * Calculates savings projections, generates SVG donut and bar charts, and identifies underused subscriptions.
 */

class AnalyticsManager {
  constructor() {
    this.hoveredCategory = null;
  }

  init() {
    this.render();
  }

  render() {
    this.renderCategoryChart();
    this.renderTimelineBarChart();
    this.renderVampireAudit();
    this.renderCycleOptimization();
  }

  renderCategoryChart() {
    const chartContainer = document.getElementById('analytics-donut-container');
    const legendContainer = document.getElementById('analytics-donut-legend');
    if (!chartContainer || !legendContainer) return;

    const subs = window.storageManager.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    const categorySpend = {};
    let totalMonthly = 0;

    subs.forEach(s => {
      let monthly = s.cost;
      if (s.billingCycle === 'Yearly') monthly = s.cost / 12;
      else if (s.billingCycle === 'Quarterly') monthly = s.cost / 3;
      else if (s.billingCycle === 'Weekly') monthly = s.cost * 4.33;

      categorySpend[s.category] = (categorySpend[s.category] || 0) + monthly;
      totalMonthly += monthly;
    });

    const categories = Object.keys(categorySpend).sort((a, b) => categorySpend[b] - categorySpend[a]);

    const palette = {
      'Entertainment': '#E50914',
      'Developer Tools': '#10B981',
      'Productivity': '#6366F1',
      'Health & Fitness': '#06B6D4',
      'Utilities & Cloud': '#3B82F6',
      'Food & Lifestyle': '#F59E0B',
      'Financial': '#8B5CF6',
      'Other': '#94A3B8'
    };

    if (totalMonthly === 0) {
      chartContainer.innerHTML = `<div class="empty-state"><p>No active spend data to graph.</p></div>`;
      legendContainer.innerHTML = '';
      return;
    }

    // Generate SVG Donut Chart
    const size = 260;
    const strokeWidth = 36;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedOffset = 0;
    let pathsHtml = '';

    categories.forEach((cat, idx) => {
      const amount = categorySpend[cat];
      const ratio = amount / totalMonthly;
      const strokeDash = ratio * circumference;
      const strokeGap = circumference - strokeDash;
      const color = palette[cat] || '#8B5CF6';

      pathsHtml += `
        <circle 
          cx="${center}" 
          cy="${center}" 
          r="${radius}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="${strokeWidth}" 
          stroke-dasharray="${strokeDash} ${strokeGap}" 
          stroke-dashoffset="-${accumulatedOffset}"
          class="donut-segment"
          data-category="${cat}"
          data-amount="${amount.toFixed(2)}"
          data-percent="${(ratio * 100).toFixed(1)}"
        />
      `;
      accumulatedOffset += strokeDash;
    });

    chartContainer.innerHTML = `
      <div class="donut-wrapper">
        <svg viewBox="0 0 ${size} ${size}" class="donut-svg">
          <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${strokeWidth}" />
          ${pathsHtml}
        </svg>
        <div class="donut-center-label">
          <span class="donut-center-sub">Total Monthly</span>
          <span class="donut-center-amount">${currency}${totalMonthly.toFixed(2)}</span>
          <span class="donut-center-annual">${currency}${(totalMonthly * 12).toFixed(0)}/yr</span>
        </div>
      </div>
    `;

    // Legend
    legendContainer.innerHTML = categories.map(cat => {
      const amt = categorySpend[cat];
      const pct = ((amt / totalMonthly) * 100).toFixed(1);
      const color = palette[cat] || '#8B5CF6';

      return `
        <div class="legend-item" data-category="${cat}">
          <div class="legend-item-left">
            <span class="legend-color-dot" style="background-color: ${color}"></span>
            <span class="legend-cat-name">${cat}</span>
          </div>
          <div class="legend-item-right">
            <span class="legend-cat-amt">${currency}${amt.toFixed(2)}</span>
            <span class="legend-cat-pct">${pct}%</span>
          </div>
        </div>
      `;
    }).join('');

    // Hover interactivity
    chartContainer.querySelectorAll('.donut-segment').forEach(seg => {
      seg.addEventListener('mouseenter', (e) => {
        const cat = e.target.getAttribute('data-category');
        const amt = e.target.getAttribute('data-amount');
        const pct = e.target.getAttribute('data-percent');
        const centerSub = chartContainer.querySelector('.donut-center-sub');
        const centerAmt = chartContainer.querySelector('.donut-center-amount');
        const centerAnnual = chartContainer.querySelector('.donut-center-annual');
        if (centerSub && centerAmt && centerAnnual) {
          centerSub.textContent = cat;
          centerAmt.textContent = `${currency}${amt}`;
          centerAnnual.textContent = `${pct}% of total`;
        }
      });

      seg.addEventListener('mouseleave', () => {
        const centerSub = chartContainer.querySelector('.donut-center-sub');
        const centerAmt = chartContainer.querySelector('.donut-center-amount');
        const centerAnnual = chartContainer.querySelector('.donut-center-annual');
        if (centerSub && centerAmt && centerAnnual) {
          centerSub.textContent = 'Total Monthly';
          centerAmt.textContent = `${currency}${totalMonthly.toFixed(2)}`;
          centerAnnual.textContent = `${currency}${(totalMonthly * 12).toFixed(0)}/yr`;
        }
      });
    });
  }

  renderTimelineBarChart() {
    const barContainer = document.getElementById('analytics-barchart-container');
    if (!barContainer) return;

    const subs = window.storageManager.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    // Group spending by day of the month (1 to 31)
    const dayTotals = {};
    for (let d = 1; d <= 31; d++) dayTotals[d] = 0;

    let maxDaySpend = 1;

    subs.forEach(s => {
      const parts = s.renewalDate.split('-');
      const day = parseInt(parts[2], 10);
      if (day >= 1 && day <= 31) {
        dayTotals[day] += s.cost;
        if (dayTotals[day] > maxDaySpend) maxDaySpend = dayTotals[day];
      }
    });

    let barsHtml = '';
    const todayDay = new Date().getDate();

    for (let d = 1; d <= 31; d++) {
      const amount = dayTotals[d];
      const heightPercent = amount > 0 ? Math.max((amount / maxDaySpend) * 100, 10) : 4;
      const isToday = d === todayDay;
      const hasSpend = amount > 0;

      barsHtml += `
        <div class="barchart-col ${isToday ? 'barchart-today' : ''} ${hasSpend ? 'has-spend' : ''}" title="Day ${d}: ${currency}${amount.toFixed(2)}">
          <div class="barchart-bar-wrapper">
            <div class="barchart-bar ${hasSpend ? 'bar-active' : ''}" style="height: ${heightPercent}%;"></div>
          </div>
          <span class="barchart-label">${d}</span>
        </div>
      `;
    }

    barContainer.innerHTML = `
      <div class="barchart-header">
        <span class="barchart-legend-hint"><span class="dot-active"></span> Outflow Peaks Across Days 1-31</span>
        <span class="barchart-max-hint">Max Single Day: ${currency}${maxDaySpend.toFixed(2)}</span>
      </div>
      <div class="barchart-grid">
        ${barsHtml}
      </div>
    `;
  }

  renderVampireAudit() {
    const auditContainer = document.getElementById('vampire-audit-cards');
    const savingsHero = document.getElementById('vampire-savings-hero');
    if (!auditContainer) return;

    const subs = window.storageManager.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    // Vampire criteria:
    // 1. Low usage score (<= 2 stars)
    // 2. Status is 'To Cancel'
    // 3. Status is 'Trial'
    const vampires = subs.filter(s => s.usageScore <= 2 || s.status === 'To Cancel' || s.status === 'Trial');

    let totalMonthlySaved = 0;
    vampires.forEach(s => {
      let monthly = s.cost;
      if (s.billingCycle === 'Yearly') monthly = s.cost / 12;
      else if (s.billingCycle === 'Quarterly') monthly = s.cost / 3;
      else if (s.billingCycle === 'Weekly') monthly = s.cost * 4.33;
      totalMonthlySaved += monthly;
    });

    const annualSaved = totalMonthlySaved * 12;
    // Compounded 3 years at 7% market return
    const threeYearCompounded = (totalMonthlySaved * 12 * 3) * 1.15;

    if (savingsHero) {
      savingsHero.innerHTML = `
        <div class="savings-card">
          <div class="savings-card-icon">💡</div>
          <div class="savings-card-content">
            <div class="savings-card-title">Monthly Vampire Leakage</div>
            <div class="savings-card-val text-red">${currency}${totalMonthlySaved.toFixed(2)}/mo</div>
            <div class="savings-card-desc">Recurring drain from underused or unwanted subscriptions</div>
          </div>
        </div>

        <div class="savings-card highlight-card">
          <div class="savings-card-icon">💰</div>
          <div class="savings-card-content">
            <div class="savings-card-title">1-Year Savings Potential</div>
            <div class="savings-card-val text-green">${currency}${annualSaved.toFixed(2)}</div>
            <div class="savings-card-desc">Instant money back in your pocket if canceled today</div>
          </div>
        </div>

        <div class="savings-card">
          <div class="savings-card-icon">📈</div>
          <div class="savings-card-content">
            <div class="savings-card-title">3-Year Invested Potential</div>
            <div class="savings-card-val text-purple">${currency}${threeYearCompounded.toFixed(2)}</div>
            <div class="savings-card-desc">If saved & invested in index funds @ 7% CAGR</div>
          </div>
        </div>
      `;
    }

    if (vampires.length === 0) {
      auditContainer.innerHTML = `
        <div class="empty-state py-6">
          <div class="empty-icon">🛡️</div>
          <h4>Zero Vampire Spend Detected!</h4>
          <p>All active subscriptions are rated high usage (3+ stars). Your recurring expenses are lean and healthy.</p>
        </div>
      `;
      return;
    }

    auditContainer.innerHTML = `
      <div class="vampire-items-list">
        ${vampires.map(v => {
          let monthly = v.cost;
          if (v.billingCycle === 'Yearly') monthly = v.cost / 12;
          else if (v.billingCycle === 'Quarterly') monthly = v.cost / 3;
          else if (v.billingCycle === 'Weekly') monthly = v.cost * 4.33;

          let flagReason = '';
          if (v.status === 'Trial') {
            flagReason = '⚠️ Free Trial Ending Soon (will auto-bill full amount)';
          } else if (v.status === 'To Cancel') {
            flagReason = '❌ Marked for Cancellation (needs final confirmation)';
          } else if (v.usageScore === 1) {
            flagReason = '🧛 Zero Usage (1★) - Pure financial waste';
          } else {
            flagReason = '📉 Infrequent Usage (2★) - High cost vs low perceived value';
          }

          return `
            <div class="vampire-row">
              <div class="vampire-row-left">
                <div class="vampire-name-badge">
                  <strong>${this.escapeHTML(v.name)}</strong>
                  <span class="vampire-category">${v.category}</span>
                </div>
                <div class="vampire-flag-reason">${flagReason}</div>
                <div class="vampire-sub-meta">
                  <span>Billing: ${currency}${v.cost.toFixed(2)}/${v.billingCycle}</span> • 
                  <span>Next: ${v.renewalDate}</span> • 
                  <span>Paid with: ${this.escapeHTML(v.paymentMethod || 'Credit Card')}</span>
                </div>
              </div>

              <div class="vampire-row-middle">
                <div class="vampire-saving-chip">
                  Save <strong>${currency}${(monthly * 12).toFixed(2)}/yr</strong>
                </div>
              </div>

              <div class="vampire-row-actions">
                ${v.cancellationUrl ? `
                  <a href="${v.cancellationUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-danger" title="Open cancellation page directly">
                    Direct Cancel 🔗
                  </a>
                ` : `
                  <button class="btn btn-sm btn-danger" onclick="window.ledgerManager.openEditModal('${v.id}')">
                    Mark Cancelled
                  </button>
                `}
                <button class="btn btn-sm btn-outline" onclick="window.alertManager.previewEmailAlert('${v.id}')" title="Send reminder alert to yourself">
                  ✉️ Alert Me
                </button>
                <button class="btn btn-sm btn-ghost" onclick="window.analyticsManager.keepSubscription('${v.id}')" title="Bump usage score to 3 stars if keeping">
                  Keep
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderCycleOptimization() {
    const optContainer = document.getElementById('cycle-optimization-card');
    if (!optContainer) return;

    const subs = window.storageManager.getSubscriptions().filter(s => s.status === 'Active' && s.billingCycle === 'Monthly');
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    // Typically switching from monthly to annual billing saves ~16-20%
    let totalMonthlyEligible = 0;
    const candidates = [];

    subs.forEach(s => {
      // High usage items (4-5 stars) that are kept long term
      if (s.usageScore >= 4) {
        totalMonthlyEligible += s.cost;
        const currentYearlyCost = s.cost * 12;
        const estimatedAnnualPlan = currentYearlyCost * 0.83; // 17% discount
        const annualSavings = currentYearlyCost - estimatedAnnualPlan;
        candidates.push({
          sub: s,
          annualSavings,
          estimatedAnnualPlan
        });
      }
    });

    const potentialAnnualDiscount = candidates.reduce((sum, c) => sum + c.annualSavings, 0);

    if (candidates.length === 0) {
      optContainer.innerHTML = `
        <div class="empty-state py-4">
          <p>No high-usage monthly subscriptions currently eligible for annual optimization.</p>
        </div>
      `;
      return;
    }

    optContainer.innerHTML = `
      <div class="optimization-card-header">
        <div>
          <h4>💡 Annual Switch & Save Advisor</h4>
          <p class="text-muted">High-usage services you use daily often give 2 months free when billed annually.</p>
        </div>
        <div class="opt-badge">
          Save up to <strong>${currency}${potentialAnnualDiscount.toFixed(2)}/yr</strong>
        </div>
      </div>

      <div class="opt-candidate-grid">
        ${candidates.slice(0, 3).map(c => `
          <div class="opt-item">
            <div class="opt-item-name"><strong>${this.escapeHTML(c.sub.name)}</strong></div>
            <div class="opt-item-pricing">
              <span>Current: ${currency}${c.sub.cost.toFixed(2)}/mo (${currency}${(c.sub.cost * 12).toFixed(2)}/yr)</span>
              <span class="text-green">Estimated Annual: ${currency}${c.estimatedAnnualPlan.toFixed(2)}/yr</span>
            </div>
            <div class="opt-item-save">
              Estimated savings: <strong>${currency}${c.annualSavings.toFixed(2)}/yr</strong>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  keepSubscription(id) {
    window.storageManager.updateSubscription(id, { usageScore: 3, status: 'Active' });
    window.app.showToast('Subscription updated: usage rating set to 3★.', 'success');
    this.render();
    if (window.ledgerManager) window.ledgerManager.render();
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.analyticsManager = new AnalyticsManager();
