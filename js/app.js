/**
 * app.js - Main Application Coordinator
 * Handles tab navigation, modals, currency switching, toast notifications, and file import/export.
 */

class App {
  constructor() {
    this.currentTab = 'tab-ledger';
  }

  init() {
    this.setupTheme();
    this.bindNavigation();
    this.bindHeaderActions();
    this.bindImportExportModal();
    this.bindKeyboardShortcuts();

    // Initialize child managers
    if (window.ledgerManager) window.ledgerManager.init();
    if (window.calendarManager) window.calendarManager.init();
    if (window.analyticsManager) window.analyticsManager.init();
    if (window.alertManager) window.alertManager.init();

    // Populate initial settings in fields
    this.populateSettingsFields();
  }

  setupTheme() {
    const settings = window.storageManager.getSettings();
    const theme = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    const themeToggleBtn = document.getElementById('btn-toggle-theme');
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
      themeToggleBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        themeToggleBtn.innerHTML = next === 'dark' ? '☀️ Light' : '🌙 Dark';
        window.storageManager.saveSettings({
          ...window.storageManager.getSettings(),
          theme: next
        });
      });
    }
  }

  populateSettingsFields() {
    const settings = window.storageManager.getSettings();
    const curSelect = document.getElementById('header-currency-select');
    if (curSelect) curSelect.value = settings.currency || '$';

    const daysInput = document.getElementById('setting-alert-days');
    if (daysInput) daysInput.value = settings.alertDaysBefore || 3;

    const emailInput = document.getElementById('setting-user-email');
    if (emailInput) emailInput.value = settings.userEmail || 'alex.morgan@financehub.com';

    const notifCheck = document.getElementById('setting-browser-notifs');
    if (notifCheck) notifCheck.checked = settings.browserNotifications !== false;
  }

  bindNavigation() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update nav tab active states
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab view panels
    document.querySelectorAll('.tab-view-panel').forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Trigger tab-specific refreshes
    if (tabId === 'tab-calendar' && window.calendarManager) {
      window.calendarManager.render();
    } else if (tabId === 'tab-analytics' && window.analyticsManager) {
      window.analyticsManager.render();
    } else if (tabId === 'tab-ledger' && window.ledgerManager) {
      window.ledgerManager.render();
    } else if (tabId === 'tab-alerts' && window.alertManager) {
      window.alertManager.renderNotificationLog();
      window.alertManager.checkImminentRenewals();
    }
  }

  bindHeaderActions() {
    // Currency Switcher
    const curSelect = document.getElementById('header-currency-select');
    if (curSelect) {
      curSelect.addEventListener('change', (e) => {
        const newCurrency = e.target.value;
        const settings = window.storageManager.getSettings();
        settings.currency = newCurrency;
        window.storageManager.saveSettings(settings);

        this.showToast(`Currency updated to ${newCurrency}`, 'info');

        // Re-render all views
        if (window.ledgerManager) window.ledgerManager.render();
        if (window.calendarManager) window.calendarManager.render();
        if (window.analyticsManager) window.analyticsManager.render();
      });
    }

    // Import/Export Modal Trigger
    const openDataModalBtn = document.getElementById('btn-open-data-modal');
    if (openDataModalBtn) {
      openDataModalBtn.addEventListener('click', () => {
        document.getElementById('import-export-modal').classList.add('active');
      });
    }
  }

  bindImportExportModal() {
    // Export Ledger CSV
    const exportLedgerBtn = document.getElementById('btn-export-ledger-csv');
    if (exportLedgerBtn) {
      exportLedgerBtn.addEventListener('click', () => {
        window.storageManager.exportLedgerCSV();
        this.showToast('Subscription Ledger exported as CSV.', 'success');
      });
    }

    // Export Summary Report CSV
    const exportSummaryBtn = document.getElementById('btn-export-summary-csv');
    if (exportSummaryBtn) {
      exportSummaryBtn.addEventListener('click', () => {
        window.storageManager.exportSpendingSummaryCSV();
        this.showToast('Spending Summary Report exported as CSV.', 'success');
      });
    }

    // Export Backup JSON
    const exportJsonBtn = document.getElementById('btn-export-backup-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        window.storageManager.exportBackupJSON();
        this.showToast('Full ledger backup exported as JSON.', 'success');
      });
    }

    // Download Sample CSV Template
    const sampleCsvBtn = document.getElementById('btn-download-sample-csv');
    if (sampleCsvBtn) {
      sampleCsvBtn.addEventListener('click', () => {
        const sampleContent = [
          'Service Name,Category,Cost,Billing Cycle,Next Renewal Date,Payment Method,Status,Usage Score,Cancellation URL,Notes',
          'Figma Pro,Productivity,15.00,Monthly,2026-11-01,Amex Gold,Active,5,https://figma.com/account,Design software',
          'Crunchyroll,Entertainment,7.99,Monthly,2026-10-25,Apple Pay,Active,2,https://crunchyroll.com,Infrequently watched anime',
          'NordVPN,Utilities & Cloud,59.88,Yearly,2027-02-14,PayPal,Active,4,https://my.nordaccount.com,Annual VPN security tier'
        ].join('\r\n');
        window.storageManager.downloadFile(sampleContent, 'SubAuditor_Sample_Template.csv', 'text/csv;charset=utf-8;');
        this.showToast('Sample CSV template downloaded.', 'info');
      });
    }

    // CSV File Input & Drag/Drop
    const fileInput = document.getElementById('csv-file-input');
    const dropArea = document.getElementById('csv-drop-area');

    if (fileInput && dropArea) {
      dropArea.addEventListener('click', () => fileInput.click());

      dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
      });

      dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('dragover');
      });

      dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.processCSVFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.processCSVFile(e.target.files[0]);
        }
      });
    }

    // Reset Demo Data
    const resetDataBtn = document.getElementById('btn-reset-demo-data');
    if (resetDataBtn) {
      resetDataBtn.addEventListener('click', () => {
        if (confirm('Reset all subscriptions to the curated sample demonstration dataset?')) {
          window.storageManager.resetToDefaultSeed();
          this.showToast('Reset to demo subscriptions successfully.', 'success');
          document.getElementById('import-export-modal').classList.remove('active');
          if (window.ledgerManager) window.ledgerManager.render();
          if (window.calendarManager) window.calendarManager.render();
          if (window.analyticsManager) window.analyticsManager.render();
        }
      });
    }
  }

  processCSVFile(file) {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      this.showToast('Please upload a valid .csv file.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const count = window.storageManager.importCSVText(text);
        this.showToast(`Successfully imported ${count} subscription(s)!`, 'success');
        document.getElementById('import-export-modal').classList.remove('active');
        if (window.ledgerManager) window.ledgerManager.render();
        if (window.calendarManager) window.calendarManager.render();
        if (window.analyticsManager) window.analyticsManager.render();
      } catch (err) {
        console.error('CSV import error:', err);
        this.showToast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Escape closes modals
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
      }

      // 'N' or Ctrl+N opens add modal when not inside an input/textarea
      if ((e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (window.ledgerManager) window.ledgerManager.openAddModal();
        }
      }

      // '/' to focus search
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        const searchInput = document.getElementById('ledger-search');
        if (searchInput) searchInput.focus();
      }
    });
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-pill toast-${type} animate-slide-in`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-text">${message}</span>`;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

window.app = new App();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
