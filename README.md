# SubAuditor — Subscription & Recurring Expense Auditor

A modern, high-aesthetic financial dashboard engineered to eliminate **subscription creep** and **vampire spend** (unnoticed, recurring personal subscriptions that silently drain your bank accounts).

---

## ✨ Key Capabilities

### 1. 📊 Subscription Ledger & Expense Tracker
- **Comprehensive Tracking**: Track service name, category, cost, billing cycle (*Monthly*, *Yearly*, *Quarterly*, *Weekly*), next renewal date, payment method (*e.g., Chase Sapphire ··4821, Apple Pay*), and status (*Active*, *Free Trial*, *Paused*, *To Cancel*).
- **Vampire Spend Detection**: Interactive 1–5 star usage rating system. Any service rated $\le$ 2 stars is flagged as a "Vampire Expense" with calculated savings projections.
- **1-Click Popular Presets**: Auto-populate details, brand icons, and direct cancellation URLs for 15+ popular services (*ChatGPT Plus, Netflix 4K, Adobe Creative Cloud, Spotify, GitHub Copilot, Amazon Prime, Equinox Gym, Apple iCloud+, YouTube Premium, Notion, Figma, Disney+, Headspace, AWS*).
- **Dual Layouts & Filtering**: Switch between a responsive Data Table view and a Visual Grid Card view. Filter by category, cycle, status, or usage score, with instant fuzzy search (`/` shortcut).

### 2. 📅 Visual Renewal Calendar & Chronological Timeline
- **Interactive Monthly Grid**: 7-column calendar showing all bill dates for any month/year, daily outflow badges, renewal chips, and day-inspection popups.
- **Chronological Urgency Timeline**: Organizes upcoming renewals into prioritized urgency tiers:
  - 🚨 **Next 3 Days (Urgent Attention)**
  - 📅 **This Week (4–7 Days)**
  - 🗓️ **Later This Month (8–30 Days)**
  - ⏳ **Future Scheduled Renewals (> 30 Days)**

### 3. 📈 Financial Spend Analytics & Waste Auditor
- **SVG Category Donut Chart**: Dynamic proportional spend breakdown with center metrics and interactive hover states.
- **Monthly Outflow Distribution Bar Chart**: Visualizes cash outflows across days 1–31 of the month to help manage cash liquidity.
- **Vampire Spend Audit Engine**: Highlights total monthly leakage, 1-year potential savings, and 3-year compounded investment growth (@ 7% CAGR) if canceled.
- **Annual Switch & Save Advisor**: Identifies daily high-usage services where switching from monthly to annual plans saves up to 17–20%.

### 4. 📤 CSV Exporter & Importer
- **Export Full Ledger (CSV)**: Complete database backup formatted for Excel, Google Sheets, or Numbers.
- **Export Spending Summary Report (CSV)**: Categorical breakdown, payment method shares, and vampire waste audit.
- **CSV Importer & Drag-and-Drop**: Upload spreadsheets to seamlessly add subscriptions.
- **Sample Template**: Downloadable CSV starter template.

### 5. ✉️ Email Alerts & Notification Dispatch Hub
- **Configurable Trigger Window**: Set alerts to fire 1, 3, 7, or 14 days prior to upcoming renewals.
- **Interactive Email Simulator**: Preview pixel-perfect transactional alert emails with renewal countdowns, payment card info, vampire warnings, and direct 1-click cancellation links.
- **Browser Push Notifications**: Integrated HTML5 desktop notification permissions.
- **Audit Notification Log**: Chronological delivery log of all dispatched reminder emails.

---

## 🚀 Getting Started

### Option A: Open directly in your browser
Simply open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).

### Option B: Run via Local Dev Server
```bash
# Using Python
python -m http.server 8080

# Or using Node / npm
npm start
```
Then visit **[http://localhost:8080](http://localhost:8080)** in your browser.

---

## ⌨️ Keyboard Shortcuts
- `N` or `Ctrl + N`: Open **New Subscription** modal
- `/`: Focus search input in Subscription Ledger
- `Esc`: Close any active modal
