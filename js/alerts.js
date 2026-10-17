/**
 * alerts.js - Email Alerts & Notification Engine
 * Manages renewal trigger rules, email simulation templates, browser notifications, and delivery log history.
 */

class AlertManager {
  constructor() {
    this.currentPreviewSubId = null;
  }

  init() {
    this.bindEvents();
    this.renderNotificationLog();
    this.checkImminentRenewals();
  }

  bindEvents() {
    // Alert trigger button in settings/header
    const triggerScanBtn = document.getElementById('btn-run-alerts-scan');
    if (triggerScanBtn) {
      triggerScanBtn.addEventListener('click', () => {
        this.runAlertsAuditScan();
      });
    }

    // Save alert settings button
    const saveSettingsBtn = document.getElementById('btn-save-alert-settings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        this.saveNotificationSettings();
      });
    }

    // Email Preview Modal - Dispatch Action
    const sendSimulatedBtn = document.getElementById('btn-email-modal-send');
    if (sendSimulatedBtn) {
      sendSimulatedBtn.addEventListener('click', () => {
        this.dispatchSimulatedEmail();
      });
    }

    // Email Preview Modal - Direct Cancel Link
    const cancelActionBtn = document.getElementById('btn-email-modal-cancel');
    if (cancelActionBtn) {
      cancelActionBtn.addEventListener('click', () => {
        this.handleEmailModalCancel();
      });
    }

    // Email Preview Modal - Keep Action
    const keepActionBtn = document.getElementById('btn-email-modal-keep');
    if (keepActionBtn) {
      keepActionBtn.addEventListener('click', () => {
        this.handleEmailModalKeep();
      });
    }

    // Clear log button
    const clearLogBtn = document.getElementById('btn-clear-notification-log');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => {
        if (confirm('Clear all alert dispatch logs?')) {
          window.storageManager.saveNotificationLog([]);
          this.renderNotificationLog();
          window.app.showToast('Notification logs cleared.', 'info');
        }
      });
    }

    // Browser notification request permission
    const reqPermBtn = document.getElementById('btn-request-notif-perm');
    if (reqPermBtn) {
      reqPermBtn.addEventListener('click', () => {
        this.requestBrowserNotificationPermission();
      });
    }
  }

  checkImminentRenewals() {
    const subs = window.storageManager.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const thresholdDays = settings.alertDaysBefore || 3;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const imminent = [];

    subs.forEach(s => {
      const renewalDate = new Date(s.renewalDate + 'T00:00:00');
      const diffDays = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= thresholdDays) {
        imminent.push({ ...s, diffDays });
      }
    });

    const banner = document.getElementById('imminent-alert-banner');
    const bannerText = document.getElementById('imminent-banner-text');
    const bannerTriggerBtn = document.getElementById('imminent-banner-trigger-btn');

    if (banner && bannerText) {
      if (imminent.length > 0) {
        banner.style.display = 'flex';
        const names = imminent.map(i => i.name).slice(0, 3).join(', ') + (imminent.length > 3 ? ` +${imminent.length - 3} more` : '');
        bannerText.innerHTML = `⚠️ <strong>${imminent.length} subscription(s)</strong> renew within the next ${thresholdDays} days: <em>${this.escapeHTML(names)}</em>`;
        if (bannerTriggerBtn) {
          bannerTriggerBtn.onclick = () => this.runAlertsAuditScan();
        }
      } else {
        banner.style.display = 'none';
      }
    }
  }

  runAlertsAuditScan() {
    const subs = window.storageManager.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = window.storageManager.getSettings();
    const thresholdDays = settings.alertDaysBefore || 3;
    const recipientEmail = settings.userEmail || 'user@example.com';
    const currency = settings.currency || '$';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueAlerts = [];

    subs.forEach(s => {
      const renewalDate = new Date(s.renewalDate + 'T00:00:00');
      const diffDays = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= thresholdDays) {
        dueAlerts.push({ ...s, diffDays });
      }
    });

    if (dueAlerts.length === 0) {
      window.app.showToast(`Audit scan complete: No subscriptions renewing within ${thresholdDays} days.`, 'success');
      return;
    }

    // Generate alerts and log them
    let dispatchedCount = 0;
    dueAlerts.forEach(sub => {
      const daysText = sub.diffDays === 0 ? 'today' : (sub.diffDays === 1 ? 'tomorrow' : `in ${sub.diffDays} days`);
      const subject = `⚠️ Alert: ${sub.name} renews ${daysText} (${currency}${sub.cost.toFixed(2)})`;

      window.storageManager.addNotificationLog({
        subscriptionName: sub.name,
        recipientEmail,
        cost: sub.cost,
        renewalDate: sub.renewalDate,
        subject
      });

      dispatchedCount++;

      // Trigger Web Notification if allowed
      this.triggerWebNotification(subject, `Upcoming charge to ${sub.paymentMethod || 'card'} on ${sub.renewalDate}.`);
    });

    this.renderNotificationLog();
    window.app.showToast(`Generated & sent ${dispatchedCount} renewal email alert(s) to ${recipientEmail}!`, 'success');

    // Auto open the first alert in the preview modal so user can immediately inspect it!
    if (dueAlerts.length > 0) {
      this.previewEmailAlert(dueAlerts[0].id);
    }
  }

  previewEmailAlert(subId) {
    const sub = window.storageManager.getSubscriptions().find(s => s.id === subId);
    if (!sub) return;

    this.currentPreviewSubId = subId;
    const settings = window.storageManager.getSettings();
    const recipientEmail = settings.userEmail || 'alex.morgan@financehub.com';
    const currency = settings.currency || '$';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewalDate = new Date(sub.renewalDate + 'T00:00:00');
    const diffDays = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

    let daysText = `in ${diffDays} days`;
    if (diffDays === 0) daysText = 'today';
    else if (diffDays === 1) daysText = 'tomorrow';
    else if (diffDays < 0) daysText = `${Math.abs(diffDays)} days ago`;

    const subject = `⚠️ Action Required: Your ${sub.name} subscription renews ${daysText} (${currency}${sub.cost.toFixed(2)})`;

    // Populate modal email elements
    document.getElementById('email-preview-subject').textContent = subject;
    document.getElementById('email-preview-to').textContent = recipientEmail;
    document.getElementById('email-preview-service-name').textContent = sub.name;
    document.getElementById('email-preview-amount').textContent = `${currency}${sub.cost.toFixed(2)} / ${sub.billingCycle.toLowerCase()}`;
    document.getElementById('email-preview-date').textContent = `${sub.renewalDate} (${daysText})`;
    document.getElementById('email-preview-pm').textContent = sub.paymentMethod || 'Credit Card on file';
    document.getElementById('email-preview-category').textContent = sub.category;

    // Vampire callout
    const vampireCallout = document.getElementById('email-preview-vampire-callout');
    if (vampireCallout) {
      if (sub.usageScore <= 2 || sub.status === 'To Cancel') {
        let annualSpend = sub.cost * 12;
        if (sub.billingCycle === 'Yearly') annualSpend = sub.cost;
        vampireCallout.style.display = 'block';
        vampireCallout.innerHTML = `
          <div class="email-alert-box warning-box">
            <strong>🧛 Vampire Spend Alert (Usage: ${sub.usageScore || 2}/5★):</strong><br>
            You have marked this service as low usage. Canceling before <strong>${sub.renewalDate}</strong> will save you <strong>${currency}${annualSpend.toFixed(2)}</strong> over the next year.
          </div>
        `;
      } else {
        vampireCallout.style.display = 'none';
      }
    }

    // Configure Cancel button
    const cancelBtn = document.getElementById('btn-email-modal-cancel');
    if (cancelBtn) {
      if (sub.cancellationUrl) {
        cancelBtn.href = sub.cancellationUrl;
        cancelBtn.target = '_blank';
        cancelBtn.style.display = 'inline-flex';
      } else {
        cancelBtn.removeAttribute('href');
        cancelBtn.onclick = () => {
          document.getElementById('email-preview-modal').classList.remove('active');
          window.ledgerManager.openEditModal(sub.id);
        };
      }
    }

    const modal = document.getElementById('email-preview-modal');
    if (modal) modal.classList.add('active');
  }

  dispatchSimulatedEmail() {
    if (!this.currentPreviewSubId) return;
    const sub = window.storageManager.getSubscriptions().find(s => s.id === this.currentPreviewSubId);
    if (!sub) return;

    const settings = window.storageManager.getSettings();
    const recipientEmail = settings.userEmail || 'user@example.com';
    const currency = settings.currency || '$';

    const subject = `⚠️ Action Required: Your ${sub.name} subscription renews soon (${currency}${sub.cost.toFixed(2)})`;

    // Add to notification log
    window.storageManager.addNotificationLog({
      subscriptionName: sub.name,
      recipientEmail,
      cost: sub.cost,
      renewalDate: sub.renewalDate,
      subject
    });

    this.renderNotificationLog();
    this.triggerWebNotification(`Email Dispatched: ${sub.name}`, `Test notification sent to ${recipientEmail}`);

    window.app.showToast(`Simulated email dispatched successfully to ${recipientEmail}!`, 'success');
    document.getElementById('email-preview-modal').classList.remove('active');
  }

  handleEmailModalKeep() {
    if (!this.currentPreviewSubId) return;
    const sub = window.storageManager.getSubscriptions().find(s => s.id === this.currentPreviewSubId);
    if (sub) {
      window.storageManager.updateSubscription(sub.id, { usageScore: 4, status: 'Active' });
      window.app.showToast(`Marked "${sub.name}" as actively kept.`, 'success');
      document.getElementById('email-preview-modal').classList.remove('active');
      if (window.ledgerManager) window.ledgerManager.render();
      if (window.analyticsManager) window.analyticsManager.render();
    }
  }

  handleEmailModalCancel() {
    if (!this.currentPreviewSubId) return;
    const sub = window.storageManager.getSubscriptions().find(s => s.id === this.currentPreviewSubId);
    if (sub) {
      window.storageManager.updateSubscription(sub.id, { status: 'To Cancel' });
      window.app.showToast(`Status updated to "To Cancel" for "${sub.name}".`, 'info');
      document.getElementById('email-preview-modal').classList.remove('active');
      if (window.ledgerManager) window.ledgerManager.render();
      if (window.analyticsManager) window.analyticsManager.render();
    }
  }

  saveNotificationSettings() {
    const days = parseInt(document.getElementById('setting-alert-days').value, 10) || 3;
    const email = document.getElementById('setting-user-email').value.trim() || 'user@example.com';
    const browserNotifs = document.getElementById('setting-browser-notifs').checked;

    window.storageManager.saveSettings({
      ...window.storageManager.getSettings(),
      alertDaysBefore: days,
      userEmail: email,
      browserNotifications: browserNotifs
    });

    window.app.showToast('Notification preferences saved.', 'success');
    this.checkImminentRenewals();
  }

  renderNotificationLog() {
    const logContainer = document.getElementById('notification-log-table-body');
    if (!logContainer) return;

    const logs = window.storageManager.getNotificationLog();
    const settings = window.storageManager.getSettings();
    const currency = settings.currency || '$';

    if (logs.length === 0) {
      logContainer.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-6">
            <span class="text-muted">No alert notifications have been dispatched yet. Click "Run Audit Scan" above to test.</span>
          </td>
        </tr>
      `;
      return;
    }

    logContainer.innerHTML = logs.map(entry => {
      const dateStr = new Date(entry.sentAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <tr>
          <td><span class="badge badge-success">✓ ${entry.status || 'Delivered'}</span></td>
          <td><strong>${this.escapeHTML(entry.subscriptionName)}</strong></td>
          <td><span class="text-muted">${this.escapeHTML(entry.recipientEmail)}</span></td>
          <td>${currency}${entry.cost ? entry.cost.toFixed(2) : '0.00'}</td>
          <td><span class="text-muted">${dateStr}</span></td>
        </tr>
      `;
    }).join('');
  }

  triggerWebNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'assets/icon.png'
        });
      } catch (e) {
        console.warn('Browser notification blocked or unsupported:', e);
      }
    }
  }

  requestBrowserNotificationPermission() {
    if (!('Notification' in window)) {
      window.app.showToast('This browser does not support HTML5 desktop notifications.', 'warning');
      return;
    }
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        window.app.showToast('Desktop notification permission granted!', 'success');
        this.triggerWebNotification('SubAuditor Alerts Active', 'You will receive proactive alerts prior to upcoming renewal charges.');
      } else {
        window.app.showToast('Notification permission was denied or dismissed.', 'warning');
      }
    });
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

window.alertManager = new AlertManager();
