/**
 * storage.js - Subscription Data Layer & CSV Exporter/Importer
 * Handles persistence, seed generation anchored to current date, CSV export/import, and data migration.
 */

const STORAGE_KEYS = {
  SUBSCRIPTIONS: 'subauditor_subscriptions_v1',
  SETTINGS: 'subauditor_settings_v1',
  NOTIFICATION_LOG: 'subauditor_notification_log_v1'
};

const DEFAULT_SETTINGS = {
  currency: '$',
  alertDaysBefore: 3,
  userEmail: 'alex.morgan@financehub.com',
  browserNotifications: true,
  theme: 'dark'
};

const PRESET_CATALOG = [
  { name: 'Netflix Premium (4K)', category: 'Entertainment', cost: 22.99, billingCycle: 'Monthly', icon: 'film', color: '#E50914', cancelUrl: 'https://www.netflix.com/youraccount' },
  { name: 'Spotify Premium', category: 'Entertainment', cost: 11.99, billingCycle: 'Monthly', icon: 'music', color: '#1DB954', cancelUrl: 'https://www.spotify.com/account' },
  { name: 'ChatGPT Plus', category: 'Developer Tools', cost: 20.00, billingCycle: 'Monthly', icon: 'cpu', color: '#10A37F', cancelUrl: 'https://chat.openai.com/#settings' },
  { name: 'GitHub Copilot Pro', category: 'Developer Tools', cost: 10.00, billingCycle: 'Monthly', icon: 'terminal', color: '#6e40c9', cancelUrl: 'https://github.com/settings/billing' },
  { name: 'Adobe Creative Cloud', category: 'Productivity', cost: 59.99, billingCycle: 'Monthly', icon: 'pen-tool', color: '#FF0000', cancelUrl: 'https://account.adobe.com/plans' },
  { name: 'Amazon Prime', category: 'Food & Lifestyle', cost: 139.00, billingCycle: 'Yearly', icon: 'shopping-bag', color: '#FF9900', cancelUrl: 'https://www.amazon.com/mc' },
  { name: 'Equinox / City Gym', category: 'Health & Fitness', cost: 65.00, billingCycle: 'Monthly', icon: 'activity', color: '#00F2FE', cancelUrl: 'https://my.gym.com/membership' },
  { name: 'Apple iCloud+ (2TB)', category: 'Utilities & Cloud', cost: 9.99, billingCycle: 'Monthly', icon: 'cloud', color: '#3b82f6', cancelUrl: 'https://support.apple.com/billing' },
  { name: 'YouTube Premium', category: 'Entertainment', cost: 13.99, billingCycle: 'Monthly', icon: 'play-circle', color: '#FF0033', cancelUrl: 'https://www.youtube.com/paid_memberships' },
  { name: 'Notion Plus', category: 'Productivity', cost: 10.00, billingCycle: 'Monthly', icon: 'file-text', color: '#4F46E5', cancelUrl: 'https://www.notion.so/settings' },
  { name: 'Figma Professional', category: 'Productivity', cost: 15.00, billingCycle: 'Monthly', icon: 'layout', color: '#F24E1E', cancelUrl: 'https://www.figma.com/settings' },
  { name: 'Disney+ Bundle', category: 'Entertainment', cost: 19.99, billingCycle: 'Monthly', icon: 'tv', color: '#113CCF', cancelUrl: 'https://www.disneyplus.com/account' },
  { name: 'Headspace App', category: 'Health & Fitness', cost: 69.99, billingCycle: 'Yearly', icon: 'smile', color: '#F47D31', cancelUrl: 'https://www.headspace.com/subscription' },
  { name: 'Wall Street Journal', category: 'Productivity', cost: 18.99, billingCycle: 'Monthly', icon: 'book-open', color: '#2563EB', cancelUrl: 'https://customercenter.wsj.com' },
  { name: 'AWS Cloud Server', category: 'Utilities & Cloud', cost: 35.50, billingCycle: 'Monthly', icon: 'server', color: '#EC4899', cancelUrl: 'https://console.aws.amazon.com/billing' }
];

class StorageManager {
  constructor() {
    this.subscriptions = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.notificationLog = [];
    this.backendReady = false;
    this.backendWriteQueue = Promise.resolve();
    this.backendErrorNotified = false;
    this.ensureInitialized();
  }

  readLegacyValue(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn(`Could not read legacy browser data for ${key}:`, error);
      return null;
    }
  }

  async initializeBackend() {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error(`SQLite API returned HTTP ${response.status}.`);
    const state = await response.json();

    if (state.initialized) {
      this.subscriptions = state.subscriptions;
      this.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
      this.notificationLog = state.notificationLog;
    } else {
      const initialState = this.getBackendState();
      const saveResponse = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialState)
      });
      if (!saveResponse.ok) throw new Error(`SQLite initialization returned HTTP ${saveResponse.status}.`);
    }

    this.backendReady = true;
  }

  getBackendState() {
    return {
      subscriptions: this.getSubscriptions(),
      settings: this.getSettings(),
      notificationLog: this.getNotificationLog()
    };
  }

  persistBackendState() {
    if (!this.backendReady) return;

    const state = JSON.parse(JSON.stringify(this.getBackendState()));
    this.backendWriteQueue = this.backendWriteQueue.then(async () => {
      const response = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      if (!response.ok) throw new Error(`SQLite save returned HTTP ${response.status}.`);
      this.backendErrorNotified = false;
    }).catch(error => {
      console.error('Could not save data to SQLite:', error);
      if (!this.backendErrorNotified && window.app) {
        window.app.showToast('SQLite save failed. Your latest changes are only in memory.', 'error');
        this.backendErrorNotified = true;
      }
    });
  }

  ensureInitialized() {
    const legacySubscriptions = this.readLegacyValue(STORAGE_KEYS.SUBSCRIPTIONS);
    const legacySettings = this.readLegacyValue(STORAGE_KEYS.SETTINGS);
    const legacyNotificationLog = this.readLegacyValue(STORAGE_KEYS.NOTIFICATION_LOG);

    this.subscriptions = Array.isArray(legacySubscriptions) ? legacySubscriptions : this.generateSeedData();
    this.settings = { ...DEFAULT_SETTINGS, ...(legacySettings || {}) };
    this.notificationLog = Array.isArray(legacyNotificationLog) ? legacyNotificationLog : [
        {
          id: 'log_seed_1',
          subscriptionName: 'Netflix Premium (4K)',
          recipientEmail: DEFAULT_SETTINGS.userEmail,
          cost: 22.99,
          renewalDate: this.formatOffsetDate(3),
          sentAt: new Date(Date.now() - 3600000 * 4).toISOString(),
          status: 'Delivered',
          subject: '⚠️ Action Required: Netflix Premium (4K) renews in 3 days'
        }
      ];
  }

  formatOffsetDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  generateSeedData() {
    return [
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'ChatGPT Plus',
        category: 'Developer Tools',
        cost: 20.00,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(2), // In 2 days! Urgent!
        paymentMethod: 'Chase Sapphire ··4821',
        status: 'Active',
        usageScore: 5,
        cancellationUrl: 'https://chat.openai.com/#settings',
        notes: 'AI coding and research assistant. Daily critical use.',
        alertDaysBefore: 3,
        createdAt: '2026-01-10'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Netflix Premium (4K)',
        category: 'Entertainment',
        cost: 22.99,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(3), // In 3 days!
        paymentMethod: 'Apple Pay (Amex)',
        status: 'Active',
        usageScore: 3,
        cancellationUrl: 'https://www.netflix.com/youraccount',
        notes: 'Family 4K plan. Price increased last quarter.',
        alertDaysBefore: 3,
        createdAt: '2025-06-15'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Adobe Creative Cloud',
        category: 'Productivity',
        cost: 59.99,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(5), // In 5 days
        paymentMethod: 'Amex Gold ··1093',
        status: 'Active',
        usageScore: 2, // Vampire spend alert! High cost, low usage!
        cancellationUrl: 'https://account.adobe.com/plans',
        notes: 'Only using Photoshop occasionally. Evaluate Canva or Affinity photo.',
        alertDaysBefore: 5,
        createdAt: '2025-09-01'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Equinox / City Gym',
        category: 'Health & Fitness',
        cost: 65.00,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(7), // In 7 days
        paymentMethod: 'Chase Sapphire ··4821',
        status: 'Active',
        usageScore: 1, // Prime Vampire spend! 1/5 stars
        cancellationUrl: 'https://my.gym.com/membership',
        notes: 'Visited zero times in the past 45 days. Major candidate to cancel or pause.',
        alertDaysBefore: 7,
        createdAt: '2026-02-01'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Spotify Duo',
        category: 'Entertainment',
        cost: 14.99,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(11),
        paymentMethod: 'PayPal ··paypal@domain.com',
        status: 'Active',
        usageScore: 5,
        cancellationUrl: 'https://www.spotify.com/account',
        notes: 'Shared with partner for podcasts and daily commutes.',
        alertDaysBefore: 3,
        createdAt: '2024-11-20'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'GitHub Copilot Pro',
        category: 'Developer Tools',
        cost: 10.00,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(14),
        paymentMethod: 'Amex Gold ··1093',
        status: 'Active',
        usageScore: 5,
        cancellationUrl: 'https://github.com/settings/billing',
        notes: 'IDE code completions and repository indexing.',
        alertDaysBefore: 3,
        createdAt: '2026-01-05'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Apple iCloud+ (2TB)',
        category: 'Utilities & Cloud',
        cost: 9.99,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(18),
        paymentMethod: 'Apple Pay',
        status: 'Active',
        usageScore: 5,
        cancellationUrl: 'https://support.apple.com/billing',
        notes: 'Full photo and device cloud backup tier.',
        alertDaysBefore: 3,
        createdAt: '2024-05-10'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Amazon Prime',
        category: 'Food & Lifestyle',
        cost: 139.00,
        currency: '$',
        billingCycle: 'Yearly',
        renewalDate: this.formatOffsetDate(22),
        paymentMethod: 'Chase Sapphire ··4821',
        status: 'Active',
        usageScore: 4,
        cancellationUrl: 'https://www.amazon.com/mc',
        notes: 'Annual billing, fast shipping and Prime Video access.',
        alertDaysBefore: 14,
        createdAt: '2025-10-22'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Headspace App',
        category: 'Health & Fitness',
        cost: 69.99,
        currency: '$',
        billingCycle: 'Yearly',
        renewalDate: this.formatOffsetDate(27),
        paymentMethod: 'Apple Pay',
        status: 'Trial', // Free trial ending!
        usageScore: 2,
        cancellationUrl: 'https://www.headspace.com/subscription',
        notes: '7-day trial period converting to $69.99/year. Needs cancellation decision.',
        alertDaysBefore: 3,
        createdAt: '2026-10-10'
      },
      {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name: 'Wall Street Journal Digital',
        category: 'Productivity',
        cost: 18.99,
        currency: '$',
        billingCycle: 'Monthly',
        renewalDate: this.formatOffsetDate(29),
        paymentMethod: 'PayPal',
        status: 'To Cancel',
        usageScore: 1,
        cancellationUrl: 'https://customercenter.wsj.com',
        notes: 'Marked for cancellation before end of current cycle.',
        alertDaysBefore: 3,
        createdAt: '2025-12-01'
      }
    ];
  }

  // --- Subscriptions CRUD ---
  getSubscriptions() {
    return this.subscriptions;
  }

  saveSubscriptions(subs) {
    this.subscriptions = subs;
    this.persistBackendState();
  }

  addSubscription(sub) {
    const list = this.getSubscriptions();
    const newSub = {
      id: 'sub_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString().split('T')[0],
      ...sub
    };
    list.push(newSub);
    this.saveSubscriptions(list);
    return newSub;
  }

  updateSubscription(id, updatedFields) {
    const list = this.getSubscriptions();
    const idx = list.findIndex(s => s.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatedFields };
      this.saveSubscriptions(list);
      return list[idx];
    }
    return null;
  }

  deleteSubscription(id) {
    const list = this.getSubscriptions().filter(s => s.id !== id);
    this.saveSubscriptions(list);
    return list;
  }

  // --- Settings ---
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...this.settings };
  }

  saveSettings(settings) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.persistBackendState();
  }

  // --- Notification Log ---
  getNotificationLog() {
    return this.notificationLog;
  }

  saveNotificationLog(logs) {
    this.notificationLog = logs;
    this.persistBackendState();
  }

  addNotificationLog(entry) {
    const logs = this.getNotificationLog();
    const newEntry = {
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      sentAt: new Date().toISOString(),
      status: 'Delivered',
      ...entry
    };
    logs.unshift(newEntry);
    // Keep max 50 recent entries
    if (logs.length > 50) logs.pop();
    this.saveNotificationLog(logs);
    return newEntry;
  }

  // --- CSV Export Engine ---
  exportLedgerCSV() {
    const subs = this.getSubscriptions();
    const headers = [
      'ID',
      'Service Name',
      'Category',
      'Cost',
      'Currency',
      'Billing Cycle',
      'Monthly Cost Equivalent',
      'Annualized Cost',
      'Next Renewal Date',
      'Days Until Renewal',
      'Payment Method',
      'Status',
      'Usage Score (1-5)',
      'Cancellation URL',
      'Notes'
    ];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = subs.map(s => {
      const renewal = new Date(s.renewalDate + 'T00:00:00');
      const diffDays = Math.ceil((renewal - today) / (1000 * 60 * 60 * 24));
      
      let monthly = s.cost;
      if (s.billingCycle === 'Yearly') monthly = s.cost / 12;
      else if (s.billingCycle === 'Quarterly') monthly = s.cost / 3;
      else if (s.billingCycle === 'Weekly') monthly = s.cost * 4.33;

      const annual = monthly * 12;

      return [
        s.id,
        this.escapeCSV(s.name),
        this.escapeCSV(s.category),
        s.cost.toFixed(2),
        s.currency || '$',
        s.billingCycle,
        monthly.toFixed(2),
        annual.toFixed(2),
        s.renewalDate,
        diffDays,
        this.escapeCSV(s.paymentMethod || 'Unspecified'),
        s.status,
        s.usageScore || 3,
        this.escapeCSV(s.cancellationUrl || ''),
        this.escapeCSV(s.notes || '')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    this.downloadFile(csvContent, `Subscriptions_Ledger_${this.getTodayISO()}.csv`, 'text/csv;charset=utf-8;');
  }

  exportSpendingSummaryCSV() {
    const subs = this.getSubscriptions().filter(s => s.status !== 'Paused');
    const settings = this.getSettings();
    const currency = settings.currency || '$';

    let totalMonthly = 0;
    const categoryTotals = {};
    const paymentTotals = {};
    let vampirePotentialSavings = 0;

    subs.forEach(s => {
      let monthly = s.cost;
      if (s.billingCycle === 'Yearly') monthly = s.cost / 12;
      else if (s.billingCycle === 'Quarterly') monthly = s.cost / 3;
      else if (s.billingCycle === 'Weekly') monthly = s.cost * 4.33;

      totalMonthly += monthly;

      // Category breakdown
      categoryTotals[s.category] = (categoryTotals[s.category] || 0) + monthly;

      // Payment method breakdown
      const pm = s.paymentMethod || 'Other/Unspecified';
      paymentTotals[pm] = (paymentTotals[pm] || 0) + monthly;

      // Low usage vampire spend (score <= 2)
      if ((s.usageScore <= 2 || s.status === 'To Cancel') && s.status !== 'Paused') {
        vampirePotentialSavings += monthly;
      }
    });

    const lines = [];
    lines.push('=== SUBSCRIPTION SPENDING AUDIT SUMMARY ===');
    lines.push(`Report Generated: ${new Date().toLocaleString()}`);
    lines.push(`Total Active Subscriptions: ${subs.length}`);
    lines.push(`Total Monthly Recurring Spend: ${currency}${totalMonthly.toFixed(2)}`);
    lines.push(`Projected Annual Spend: ${currency}${(totalMonthly * 12).toFixed(2)}`);
    lines.push(`Identified Vampire Spend (Low Usage <=2★): ${currency}${vampirePotentialSavings.toFixed(2)} / month (${currency}${(vampirePotentialSavings * 12).toFixed(2)} / year)`);
    lines.push('');
    lines.push('--- SPEND BY CATEGORY ---');
    lines.push('Category,Monthly Spend,Share of Total,Annual Spend');
    Object.keys(categoryTotals).sort((a,b) => categoryTotals[b] - categoryTotals[a]).forEach(cat => {
      const amount = categoryTotals[cat];
      const pct = ((amount / (totalMonthly || 1)) * 100).toFixed(1) + '%';
      lines.push(`${this.escapeCSV(cat)},${amount.toFixed(2)},${pct},${(amount * 12).toFixed(2)}`);
    });

    lines.push('');
    lines.push('--- SPEND BY PAYMENT METHOD ---');
    lines.push('Payment Method,Monthly Spend,Share of Total');
    Object.keys(paymentTotals).sort((a,b) => paymentTotals[b] - paymentTotals[a]).forEach(pm => {
      const amount = paymentTotals[pm];
      const pct = ((amount / (totalMonthly || 1)) * 100).toFixed(1) + '%';
      lines.push(`${this.escapeCSV(pm)},${amount.toFixed(2)},${pct}`);
    });

    const csvContent = lines.join('\r\n');
    this.downloadFile(csvContent, `Spending_Audit_Summary_${this.getTodayISO()}.csv`, 'text/csv;charset=utf-8;');
  }

  exportBackupJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      subscriptions: this.getSubscriptions(),
      notificationLog: this.getNotificationLog()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    this.downloadFile(jsonStr, `SubAuditor_Backup_${this.getTodayISO()}.json`, 'application/json');
  }

  // --- CSV Import Engine ---
  importCSVText(csvText) {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file is empty or missing data rows.');
    }

    const headers = this.parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Check key required columns
    const nameIdx = headers.findIndex(h => h.includes('service') || h.includes('name'));
    const costIdx = headers.findIndex(h => h.includes('cost') || h.includes('amount') || h.includes('price'));
    const dateIdx = headers.findIndex(h => h.includes('renewal') || h.includes('date') || h.includes('bill'));

    if (nameIdx === -1 || costIdx === -1) {
      throw new Error('CSV must contain at least "Service Name" and "Cost" columns.');
    }

    const categoryIdx = headers.findIndex(h => h.includes('category'));
    const cycleIdx = headers.findIndex(h => h.includes('cycle') || h.includes('billing') || h.includes('frequency'));
    const pmIdx = headers.findIndex(h => h.includes('payment') || h.includes('card') || h.includes('method'));
    const statusIdx = headers.findIndex(h => h.includes('status'));
    const usageIdx = headers.findIndex(h => h.includes('usage') || h.includes('score'));
    const cancelIdx = headers.findIndex(h => h.includes('cancel'));
    const notesIdx = headers.findIndex(h => h.includes('notes') || h.includes('memo'));

    const imported = [];
    const todayISO = this.getTodayISO();

    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCSVLine(lines[i]);
      if (!row || row.length <= nameIdx) continue;

      const name = row[nameIdx]?.trim();
      if (!name) continue;

      const costRaw = row[costIdx]?.replace(/[^0-9.]/g, '');
      const cost = parseFloat(costRaw) || 0;

      let renewalDate = dateIdx !== -1 && row[dateIdx] ? row[dateIdx].trim() : todayISO;
      // Normalise date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(renewalDate)) {
        const parsed = new Date(renewalDate);
        if (!isNaN(parsed.getTime())) {
          renewalDate = parsed.toISOString().split('T')[0];
        } else {
          renewalDate = todayISO;
        }
      }

      let category = categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx].trim() : 'Utilities & Cloud';
      let billingCycle = cycleIdx !== -1 && row[cycleIdx] ? row[cycleIdx].trim() : 'Monthly';
      // Normalize cycle
      if (billingCycle.toLowerCase().includes('year') || billingCycle.toLowerCase().includes('annual')) billingCycle = 'Yearly';
      else if (billingCycle.toLowerCase().includes('quarter')) billingCycle = 'Quarterly';
      else if (billingCycle.toLowerCase().includes('week')) billingCycle = 'Weekly';
      else billingCycle = 'Monthly';

      const paymentMethod = pmIdx !== -1 && row[pmIdx] ? row[pmIdx].trim() : 'Credit Card';
      let status = statusIdx !== -1 && row[statusIdx] ? row[statusIdx].trim() : 'Active';
      if (!['Active', 'Trial', 'Paused', 'To Cancel'].includes(status)) status = 'Active';

      let usageScore = usageIdx !== -1 ? parseInt(row[usageIdx]) : 3;
      if (isNaN(usageScore) || usageScore < 1 || usageScore > 5) usageScore = 3;

      const cancellationUrl = cancelIdx !== -1 && row[cancelIdx] ? row[cancelIdx].trim() : '';
      const notes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx].trim() : 'Imported via CSV';

      imported.push({
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        name,
        category,
        cost,
        currency: '$',
        billingCycle,
        renewalDate,
        paymentMethod,
        status,
        usageScore,
        cancellationUrl,
        notes,
        alertDaysBefore: 3,
        createdAt: todayISO
      });
    }

    if (imported.length === 0) {
      throw new Error('No valid subscription rows could be parsed from the file.');
    }

    const currentList = this.getSubscriptions();
    const merged = [...currentList, ...imported];
    this.saveSubscriptions(merged);
    return imported.length;
  }

  // --- Helper Utilities ---
  parseCSVLine(text) {
    const entries = [];
    let insideQuote = false;
    let entry = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (insideQuote && text[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        entries.push(entry);
        entry = '';
      } else {
        entry += char;
      }
    }
    entries.push(entry);
    return entries;
  }

  escapeCSV(val) {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  getTodayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  resetToDefaultSeed() {
    const seed = this.generateSeedData();
    this.saveSubscriptions(seed);
    return seed;
  }
}

window.storageManager = new StorageManager();
