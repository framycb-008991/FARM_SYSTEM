/* ==========================================================================
   MECUZI FARM MANAGEMENT SYSTEM — Core Application Logic (Fully Localized Tables)
   Implementing I18N_SPEC.md & FRONTEND_SPEC.md & BACKEND_SPEC.md
   Zero Untranslated Strings • 100% Dynamic Table Translation
   ========================================================================== */

const AppState = {
  currentRole: null, // set ONLY from the authenticated session's JWT role claim
  currentUser: null,
  currentTab: null,
  isOffline: false,
  attachedPhoto: null,
  accessToken: null,      // public server-derived claims object; cookie stays HttpOnly
  claims: null,           // public session claims { sub, employeeNumber, name, role }
  authChallengeId: null,  // legacy no-op: OTP is disabled for workbook-only demo auth
  pendingToken: null,     // legacy no-op: permanent password changes are out of scope
  pendingEmployee: null
};

// Sidebar Nav Configuration with i18n Keys per Role
const ROLE_NAV_CONFIG = {
  top_management: [
    { id: 'tm_overview', i18n: 'nav.tm_overview', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>' },
    { id: 'tm_yield', i18n: 'nav.tm_yield', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line></svg>', badge: '48.5 t' },
    { id: 'tm_trends', i18n: 'nav.tm_trends', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>' },
    { id: 'tm_fields', i18n: 'nav.tm_fields', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>', badge: '6' }
  ],
  farm_technician: [
    { id: 'ft_myfields', i18n: 'nav.ft_myfields', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20"></path><path d="M12 2v20"></path><path d="M7 9a5 5 0 0 1 10 0"></path></svg>', badge: '2' },
    { id: 'ft_newreport', i18n: 'nav.ft_newreport', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' },
    { id: 'ft_map', i18n: 'nav.ft_map', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' },
    { id: 'ft_syncstatus', i18n: 'nav.ft_syncstatus', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>', badge: '1' }
  ],
  production_manager: [
    { id: 'pm_review', i18n: 'nav.pm_review', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>', badge: '2' },
    { id: 'pm_cycles', i18n: 'nav.pm_cycles', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' },
    { id: 'pm_map', i18n: 'nav.pm_map', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' },
    { id: 'pm_assignments', i18n: 'nav.pm_assignments', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>' },
    { id: 'pm_reports', i18n: 'nav.pm_reports', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' }
  ],
  administrator: [
    { id: 'adm_employees', i18n: 'nav.adm_employees', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>', badge: '7' },
    { id: 'adm_rolesfields', i18n: 'nav.adm_rolesfields', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
    { id: 'adm_audit', i18n: 'nav.adm_audit', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>', badge: 'Logs' },
    { id: 'adm_settings', i18n: 'nav.adm_settings', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="3" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' }
  ],

  /* --- Administrative Operations module (ADMIN_OPERATIONS_DASHBOARD_SPEC.md §3.1) ---
     admin_manager: all sidebar items. Unit leads: ONLY their own section —
     other sections are hidden from the sidebar entirely, not disabled. --- */
  admin_manager: [
    { id: 'ops_overview', i18n: 'nav.ops_overview', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>' },
    { id: 'ops_finance', i18n: 'nav.ops_finance', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' },
    { id: 'ops_operations', i18n: 'nav.ops_operations', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>' },
    { id: 'ops_hr', i18n: 'nav.ops_hr', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' },
    { id: 'ops_reports', i18n: 'nav.ops_reports', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' },
    { id: 'ops_settings', i18n: 'nav.ops_settings', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82.33H9a1.65 1.65 0 0 0-1-1.51z"></path></svg>' }
  ],
  finance_compliance_lead: [
    { id: 'ops_finance', i18n: 'nav.ops_finance', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' }
  ],
  operations_support_lead: [
    { id: 'ops_operations', i18n: 'nav.ops_operations', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>' }
  ],
  hr_facility_lead: [
    { id: 'ops_hr', i18n: 'nav.ops_hr', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' }
  ],
  driver: [
    { id: 'entry_form', i18n: 'nav.entry_form', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' },
    { id: 'entry_sync', i18n: 'nav.entry_sync', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' }
  ],
  warehouse_assistant: [
    { id: 'entry_form', i18n: 'nav.entry_form', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' },
    { id: 'entry_sync', i18n: 'nav.entry_sync', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' }
  ],
  cook: [
    { id: 'entry_form', i18n: 'nav.entry_form', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' },
    { id: 'entry_sync', i18n: 'nav.entry_sync', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' }
  ],
  cleaning_assistant: [
    { id: 'entry_form', i18n: 'nav.entry_form', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' },
    { id: 'entry_sync', i18n: 'nav.entry_sync', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' }
  ]
};

/* ==========================================================================
   Administrative Operations — module configuration
   (ADMIN_OPERATIONS_DASHBOARD_SPEC.md §4–§7)
   ========================================================================== */

// Several roles share one dashboard shell / one entry shell (spec §1)
const ROLE_INTERFACE = {
  top_management: 'interface_top_management',
  farm_technician: 'interface_farm_technician',
  production_manager: 'interface_production_manager',
  administrator: 'interface_administrator',
  admin_manager: 'interface_admin_ops',
  finance_compliance_lead: 'interface_admin_ops',
  operations_support_lead: 'interface_admin_ops',
  hr_facility_lead: 'interface_admin_ops',
  driver: 'interface_ops_entry',
  warehouse_assistant: 'interface_ops_entry',
  cook: 'interface_ops_entry',
  cleaning_assistant: 'interface_ops_entry'
};

const OPS_PANEL_ROLES = ['admin_manager', 'finance_compliance_lead', 'operations_support_lead', 'hr_facility_lead'];
const OPS_ENTRY_ROLES = ['driver', 'warehouse_assistant', 'cook', 'cleaning_assistant'];

const ACCESS_SCOPE_BY_ROLE = {
  top_management: { level: 'access.full', description: 'access.full_desc' },
  admin_manager: { level: 'access.full', description: 'access.full_desc' },
  administrator: { level: 'access.limited', description: 'access.limited_desc' }
};

// Which sections each panel role may see (spec §3.1) — the sidebar renders
// ONLY these; the API independently enforces the same scoping (§3.2).
const OPS_ROLE_SECTIONS = {
  admin_manager: ['finance', 'operations', 'hr_services'],
  finance_compliance_lead: ['finance'],
  operations_support_lead: ['operations'],
  hr_facility_lead: ['hr_services']
};

// Sub-view definitions per section (spec §4.1, §5.1, §6.1).
// Columns map onto the entity fields seeded in js/data.js.
const OPS_SECTIONS = {
  finance: [
    { titleKey: 'ops.vw_budget', entity: 'budget_line', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.crop', f: 'crop' }, { h: 'ops.th.activity', f: 'activity' },
      { h: 'ops.th.planned', f: 'plannedMzn', fmt: 'mzn' }, { h: 'ops.th.actual', f: 'actualMzn', fmt: 'mzn' },
      { h: 'ops.th.period', f: 'period' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_payments', entity: 'payment', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.beneficiary', f: 'beneficiary' },
      { h: 'ops.th.category', f: 'category' }, { h: 'ops.th.amount', f: 'amountMzn', fmt: 'mzn' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_costs', entity: 'cost_entry', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.period', f: 'period' }, { h: 'ops.th.crop', f: 'crop' },
      { h: 'ops.th.activity', f: 'activity' }, { h: 'ops.th.total', f: 'totalMzn', fmt: 'mzn' } ] },
    { titleKey: 'ops.vw_procurement', entity: 'procurement_request', reviewable: true, cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.item', f: 'item' },
      { h: 'ops.th.qty', f: 'quantity' }, { h: 'ops.th.supplier', f: 'supplier' },
      { h: 'ops.th.amount', f: 'amountMzn', fmt: 'mzn' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_stock_recon', entity: 'stock_reconciliation', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.item', f: 'item' },
      { h: 'ops.th.system_qty', f: 'systemQty' }, { h: 'ops.th.physical_qty', f: 'physicalQty' },
      { h: 'ops.th.variance', f: 'variance' }, { h: 'ops.th.value', f: 'valueMzn', fmt: 'mzn' } ] },
    { titleKey: 'ops.vw_cash_recon', entity: 'cash_reconciliation', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.expected', f: 'expectedMzn', fmt: 'mzn' },
      { h: 'ops.th.counted', f: 'countedMzn', fmt: 'mzn' }, { h: 'ops.th.variance', f: 'variance' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_fin_reports', entity: 'financial_report', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.period', f: 'period' }, { h: 'ops.th.type', f: 'type' },
      { h: 'ops.th.generated', f: 'generatedAt' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_documents', entity: 'document_record', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.title', f: 'title' }, { h: 'ops.th.tag', f: 'tag' },
      { h: 'ops.th.status', f: 'status', fmt: 'badge' }, { h: 'ops.th.updated', f: 'updatedAt' } ] }
  ],
  operations: [
    { titleKey: 'ops.vw_inventory', entity: 'inventory_item', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.item', f: 'item' }, { h: 'ops.th.category', f: 'category' },
      { h: 'ops.th.qty', f: 'quantity' }, { h: 'ops.th.unit', f: 'unit' }, { h: 'ops.th.threshold', f: 'threshold' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_requisitions', entity: 'field_requisition', reviewable: true, cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.technician', f: 'technician' },
      { h: 'ops.th.item', f: 'item' }, { h: 'ops.th.qty', f: 'quantity' }, { h: 'tm.th_field', f: 'field' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_postharvest', entity: 'postharvest_batch', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.batch', f: 'batch' }, { h: 'ops.th.date', f: 'date' },
      { h: 'ops.th.crop', f: 'crop' }, { h: 'ops.th.qty_kg', f: 'quantityKg' }, { h: 'ops.th.stage', f: 'stage' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_transport', entity: 'transport_log', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.vehicle', f: 'vehicle' },
      { h: 'ops.th.driver', f: 'driver' }, { h: 'ops.th.destination', f: 'destination' }, { h: 'ops.th.km', f: 'km' }, { h: 'ops.th.fuel', f: 'fuelL' } ] },
    { titleKey: 'ops.vw_warehouse', entity: 'warehouse_ledger_entry', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.item', f: 'item' },
      { h: 'ops.th.type', f: 'type', fmt: 'badge' }, { h: 'ops.th.qty', f: 'quantity' }, { h: 'ops.th.balance', f: 'balance' } ] },
    { titleKey: 'ops.vw_boreholes', entity: 'borehole_reading', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.borehole', f: 'borehole' },
      { h: 'ops.th.reading', f: 'readingM3' }, { h: 'ops.th.avg', f: 'avgM3' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_waste', entity: 'waste_log', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.category', f: 'category' },
      { h: 'ops.th.qty_kg', f: 'quantityKg' }, { h: 'ops.th.destination', f: 'destination' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_harvest', entity: 'harvest_task', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'tm.th_field', f: 'field' },
      { h: 'ops.th.task', f: 'task' }, { h: 'ops.th.responsible', f: 'responsible' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] }
  ],
  hr_services: [
    { titleKey: 'ops.vw_meals', entity: 'meal_log', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.meal', f: 'meal' },
      { h: 'ops.th.servings', f: 'servings' }, { h: 'ops.th.compliance', f: 'compliance' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_kitchen', entity: 'kitchen_stock', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.item', f: 'item' }, { h: 'ops.th.qty', f: 'quantity' },
      { h: 'ops.th.unit', f: 'unit' }, { h: 'ops.th.expiry', f: 'expiry' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_wellbeing', entity: 'wellbeing_note', sensitive: true, cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.category', f: 'category' },
      { h: 'ops.th.note', f: 'note' }, { h: 'ops.th.followup', f: 'followUp' } ] },
    { titleKey: 'ops.vw_hygiene', entity: 'hygiene_checklist', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.area', f: 'area' },
      { h: 'ops.th.completed', f: 'completedPct', fmt: 'pct' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] },
    { titleKey: 'ops.vw_firstaid', entity: 'first_aid_log', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.item', f: 'item' },
      { h: 'ops.th.used', f: 'usedQty' }, { h: 'ops.th.remaining', f: 'remainingQty' }, { h: 'ops.th.reported_to', f: 'reportedTo' } ] },
    { titleKey: 'ops.vw_maintenance', entity: 'maintenance_ticket', cols: [
      { h: 'ops.th.id', f: 'id' }, { h: 'ops.th.date', f: 'date' }, { h: 'ops.th.location', f: 'location' },
      { h: 'ops.th.task', f: 'task' }, { h: 'ops.th.priority', f: 'priority', fmt: 'badge' }, { h: 'ops.th.status', f: 'status', fmt: 'badge' } ] }
  ]
};

// Operational Data Entry form sets per role (spec §7) — one shell, forms
// swapped in on login. The API re-validates the form set per role (§7.1).
const OPS_ENTRY_FORMS = {
  driver: [
    { formId: 'trip_log', titleKey: 'entry.form_trip_log', fields: [
      { k: 'destination', t: 'text', l: 'entry.f_destination' }, { k: 'purpose', t: 'text', l: 'entry.f_purpose' },
      { k: 'km', t: 'number', l: 'entry.f_km' }, { k: 'fuelL', t: 'number', l: 'entry.f_fuel' } ] },
    { formId: 'breakdown_report', titleKey: 'entry.form_breakdown', fields: [
      { k: 'vehicle', t: 'text', l: 'entry.f_vehicle' }, { k: 'description', t: 'text', l: 'entry.f_description' },
      { k: 'severity', t: 'select', l: 'entry.f_severity', options: ['v.baixa', 'v.media', 'v.alta'] } ] }
  ],
  warehouse_assistant: [
    { formId: 'stock_movement', titleKey: 'entry.form_stock_movement', fields: [
      { k: 'item', t: 'text', l: 'entry.f_item' }, { k: 'type', t: 'select', l: 'entry.f_mov_type', options: ['v.entrada', 'v.saida'] },
      { k: 'quantity', t: 'number', l: 'entry.f_quantity' } ] },
    { formId: 'daily_count', titleKey: 'entry.form_daily_count', fields: [
      { k: 'item', t: 'text', l: 'entry.f_item' }, { k: 'countedQty', t: 'number', l: 'entry.f_counted' },
      { k: 'expectedQty', t: 'number', l: 'entry.f_expected' } ] },
    { formId: 'damage_report', titleKey: 'entry.form_damage', fields: [
      { k: 'item', t: 'text', l: 'entry.f_item' }, { k: 'description', t: 'text', l: 'entry.f_description' } ] }
  ],
  cook: [
    { formId: 'meal_served', titleKey: 'entry.form_meal_served', fields: [
      { k: 'meal', t: 'select', l: 'entry.f_meal', options: ['v.pequeno_almoco', 'v.almoco', 'v.jantar'] },
      { k: 'servings', t: 'number', l: 'entry.f_servings' } ] },
    { formId: 'food_stock', titleKey: 'entry.form_food_stock', fields: [
      { k: 'item', t: 'text', l: 'entry.f_item' }, { k: 'quantity', t: 'number', l: 'entry.f_quantity' },
      { k: 'expiry', t: 'text', l: 'entry.f_expiry' } ] },
    { formId: 'restock_request', titleKey: 'entry.form_restock', fields: [
      { k: 'item', t: 'text', l: 'entry.f_item' }, { k: 'quantity', t: 'number', l: 'entry.f_quantity' },
      { k: 'urgency', t: 'select', l: 'entry.f_urgency', options: ['v.baixa', 'v.media', 'v.alta'] } ] }
  ],
  cleaning_assistant: [
    { formId: 'cleaning_checklist', titleKey: 'entry.form_cleaning', fields: [
      { k: 'area', t: 'text', l: 'entry.f_area' }, { k: 'completedPct', t: 'number', l: 'entry.f_completed_pct' } ] },
    { formId: 'facility_anomaly', titleKey: 'entry.form_facility_anomaly', fields: [
      { k: 'location', t: 'text', l: 'entry.f_location' }, { k: 'description', t: 'text', l: 'entry.f_description' },
      { k: 'severity', t: 'select', l: 'entry.f_severity', options: ['v.baixa', 'v.media', 'v.alta'] } ] },
    { formId: 'basic_maintenance', titleKey: 'entry.form_basic_maintenance', fields: [
      { k: 'location', t: 'text', l: 'entry.f_location' }, { k: 'task', t: 'text', l: 'entry.f_task' },
      { k: 'status', t: 'select', l: 'ops.th.status', options: ['v.em_curso', 'v.concluido'] } ] }
  ]
};

// Alert chip visibility per role (spec §10 — reuse existing alert definitions,
// surfaced to the relevant roles; no duplicated alert logic).
// Original 4 roles keep seeing exactly what they see today (no regression).
const ALERT_ROLE_MAP = {
  water: ['top_management', 'production_manager', 'operations_support_lead', 'admin_manager'],
  mech: ['top_management', 'production_manager', 'operations_support_lead', 'admin_manager'],
  coverage: ['top_management', 'administrator', 'hr_facility_lead', 'admin_manager'],
  fuel: ['top_management', 'finance_compliance_lead', 'admin_manager'],
  budget: ['admin_manager'] // day-20 budget submission reminder (spec §8)
};

/* ==========================================================================
   Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  document.getElementById('authStep2')?.remove();
  document.getElementById('authStep3')?.remove();
  document.getElementById('authEmpNumber')?.remove();
  document.getElementById('authPin')?.remove();
  document.getElementById('newPermanentPin')?.remove();
  document.getElementById('confirmPermanentPin')?.remove();
  // 1. Language selector setup
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = currentLocale;
    langSelect.addEventListener('change', (e) => {
      setLocale(e.target.value);
      showToast(t('app.title') + ' — ' + e.target.selectedOptions[0].text, 'success');
    });
  }
  document.getElementById('investorScenarioCase')?.addEventListener('change', renderInvestorScenario);
  document.getElementById('investorPriceAdjustment')?.addEventListener('input', renderInvestorScenario);

  // 2. Register global locale change hook (I18N_SPEC.md §1 & §10)
  window.onLocaleChange = (newLocale) => {
    updateAccountUi();
    if (AppState.currentRole) {
      updateHeroBanner(AppState.currentRole);
      renderSidebarNav(AppState.currentRole);
      renderDataForRole(AppState.currentRole);
      renderFieldSelectOptions();
      updateUrlHash(AppState.currentRole);
      renderClimateAlerts(); // climate/fire chips + cards re-translate too (§10)
    }
  };

  // 3. Login / Logout button (no role picker anywhere — ACCESS_CONTROL_FIX.md §2.2)
  const authBtn = document.getElementById('openAuthModalBtn');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      closeMobileHeaderMenu();
      if (AppState.accessToken) {
        logout();
      } else {
        openAuthModal();
      }
    });
  }

  const mobileMenuBtn = document.getElementById('mobileHeaderMenuBtn');
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileHeaderMenu);

  // 4. Offline status toggle
  const connChip = document.getElementById('connectivityChip');
  if (connChip) {
    connChip.addEventListener('click', toggleOfflineMode);
  }

  // 5. Copilot triggers
  const copilotBtn = document.getElementById('openCopilotBtn');
  if (copilotBtn) {
    copilotBtn.addEventListener('click', openCopilot);
  }

  // 6. Alert bar toggle
  setupAlertBarToggle();

  // 7. Deep-link guard: manually typed dashboard URLs are checked against the
  //    session role and redirected (ACCESS_CONTROL_FIX.md §2.3, QA checklist)
  window.addEventListener('hashchange', handleHashRoute);

  // 8. Apply stored locale and restore the session (or force login first)
  setLocale(currentLocale);
  const demoSelect = document.getElementById('demoAccountSelect');
  if (demoSelect) {
    demoSelect.addEventListener('change', () => {
      const submit = document.getElementById('demoAccountSubmit');
      if (submit) submit.disabled = !demoSelect.value;
    });
    loadDemoAccounts();
  }
  updateAccountUi();
  restoreSession();
}

function toggleMobileHeaderMenu() {
  const header = document.querySelector('.app-header');
  const button = document.getElementById('mobileHeaderMenuBtn');
  if (!header || !button) return;
  const open = !header.classList.contains('mobile-menu-open');
  header.classList.toggle('mobile-menu-open', open);
  button.setAttribute('aria-expanded', String(open));
  button.querySelector('.mobile-header-menu-icon').textContent = open ? '×' : '☰';
  document.getElementById('mobileHeaderMenuLabel').textContent = open ? 'Close' : 'Menu';
}

function closeMobileHeaderMenu() {
  const header = document.querySelector('.app-header');
  const button = document.getElementById('mobileHeaderMenuBtn');
  if (!header || !button) return;
  header.classList.remove('mobile-menu-open');
  button.setAttribute('aria-expanded', 'false');
  button.querySelector('.mobile-header-menu-icon').textContent = '☰';
  document.getElementById('mobileHeaderMenuLabel').textContent = 'Menu';
}

/* ==========================================================================
   Session, Role-Based Routing & Route Guards (ACCESS_CONTROL_FIX.md §2–§3)
   ========================================================================== */

// The ONE routing function used after login/OTP for every account (§3.5).
// The only thing that differs per account is the `role` claim in its token.
function routeToRoleDashboard(role) {
  switchRole(role);
}

function updateUrlHash(roleKey) {
  const segment = ROLE_TO_ROUTE[roleKey];
  if (segment) {
    history.replaceState(null, '', `#/${currentLocale}/dashboard/${segment}`);
  }
}

function handleHashRoute() {
  if (!AppState.claims) return;
  const match = location.hash.match(/^#\/[a-z]{2}-[A-Z]{2}\/dashboard\/(\w+)$/);
  if (!match) return;
  const segment = match[1];
  const isValidSegment = Object.values(ROLE_TO_ROUTE).includes(segment);
  if (!isValidSegment) return;
  // Several roles can share a segment (e.g. all ops leads → 'ops'), so compare
  // the SESSION role's segment — typing another role's URL takes you to your
  // own dashboard, never to a dead end (ACCESS_CONTROL_FIX.md §2.3).
  if (ROLE_TO_ROUTE[AppState.claims.role] !== segment) {
    showToast(t('app.redirected_own_dashboard'), 'warning');
  }
  switchRole(AppState.claims.role);
}

// Frontend route guard (UX layer only — the API re-checks every call, §2.4).
// A user landing on another role's interface is taken to their own dashboard,
// never to a dead end (§2.3).
function guardRoleInterface(requestedRole) {
  const sessionRole = AppState.claims ? AppState.claims.role : null;
  if (!sessionRole) return requestedRole;
  if (requestedRole !== sessionRole && ROLE_NAV_CONFIG[requestedRole]) {
    showToast(t('app.redirected_own_dashboard'), 'warning');
    return sessionRole;
  }
  return requestedRole;
}

async function restoreSession() {
  const auth = await MockAPI.verifyAccessToken(AppState.accessToken);
  if (auth.ok) {
    AppState.accessToken = auth.claims;
    AppState.claims = auth.claims;
    AppState.currentUser = MECUZI_DATA.employees.find(e => e.employeeNumber === auth.claims.sub) || {
      employeeNumber: auth.claims.sub,
      name: auth.claims.name,
      role: auth.claims.role,
      roleKey: auth.claims.roleKey,
      status: auth.claims.status || 'active'
    };
    document.body.classList.add('authenticated');
    updateAccountUi();
    routeToRoleDashboard(auth.claims.role);
    return;
  }
  // No valid server session → the app stays locked behind the login modal.
  openAuthModal();
}

function updateAccountUi() {
  const label = document.getElementById('currentRoleLabel');
  const btnLabel = document.getElementById('authBtnLabel');
  if (label) {
    label.textContent = AppState.claims ? t('roles.' + AppState.claims.role) : '—';
  }
  if (btnLabel) {
    btnLabel.textContent = AppState.accessToken ? t('app.btn_logout') : t('app.btn_login');
  }
}

async function logout() {
  try { await MockAPI.logout(); } catch (e) { /* offline/local failure: clear UI anyway */ }
  AppState.accessToken = null;
  AppState.claims = null;
  AppState.currentUser = null;
  document.body.classList.remove('authenticated');
  updateAccountUi();
  openAuthModal();
}

/* ==========================================================================
   Interface Switching (always through the role guard above)
   ========================================================================== */
function switchRole(roleKey) {
  if (!ROLE_NAV_CONFIG[roleKey]) return;
  roleKey = guardRoleInterface(roleKey); // never trust the caller — session role wins
  AppState.currentRole = roleKey;

  // 1. Hide all role interfaces and show active one (several roles may share
  //    one shell — ROLE_INTERFACE maps role → container, spec §1)
  document.querySelectorAll('.role-interface-container').forEach(el => {
    el.style.display = 'none';
  });
  const targetInterface = document.getElementById(ROLE_INTERFACE[roleKey] || `interface_${roleKey}`);
  if (targetInterface) {
    targetInterface.style.display = 'block';
  }

  // 2. Render Sidebar Navigation for the active role
  renderSidebarNav(roleKey);

  // 3. Update Hero Banner Info
  updateHeroBanner(roleKey);

  // 4. Activate First Tab of that Role
  const firstTab = ROLE_NAV_CONFIG[roleKey][0].id;
  switchTab(firstTab);

  // 5. Render Data for that Role (Fully Localized)
  renderDataForRole(roleKey);

  // 6. Reflect the role dashboard in the URL (e.g. #/pt-MZ/dashboard/technician)
  updateUrlHash(roleKey);

  // 7. Filter the critical-alerts strip to what this role may see (spec §10)
  applyAlertVisibility(roleKey);

  // 8. Inject climate & fire alerts into the SAME banner (WEATHER_INTEGRATION_SPEC.md §6)
  renderClimateAlerts();
}

function applyAlertVisibility(roleKey) {
  document.querySelectorAll('.alert-ticker-chip[data-alert]').forEach(chip => {
    const alertKey = chip.getAttribute('data-alert');
    const allowed = ALERT_ROLE_MAP[alertKey];
    chip.style.display = (!allowed || allowed.includes(roleKey)) ? '' : 'none';
  });
}

function renderSidebarNav(roleKey) {
  const listEl = document.getElementById('sidebarNavList');
  const titleEl = document.getElementById('sidebarRoleTitle');
  if (!listEl) return;

  if (titleEl) {
    titleEl.textContent = t('app.sidebar_role_title');
  }

  const items = ROLE_NAV_CONFIG[roleKey] || [];
  listEl.innerHTML = items.map((item) => {
    const badgeHtml = item.badge ? `<span class="nav-badge-pill">${item.badge}</span>` : '';
    const activeClass = item.id === AppState.currentTab ? 'active' : '';

    return `
      <li class="sidebar-nav-item">
        <button class="sidebar-nav-btn ${activeClass}" data-tab="${item.id}" aria-label="${t(item.i18n)}" title="${t(item.i18n)}" ${activeClass ? 'aria-current="page"' : ''} onclick="switchTab('${item.id}')">
          <div class="nav-btn-content">
            <span class="nav-btn-icon">${item.icon}</span>
            <span class="nav-btn-text">${t(item.i18n)}</span>
          </div>
          ${badgeHtml}
        </button>
      </li>
    `;
  }).join('');

  const accessSection = document.getElementById('sidebarAccessSection');
  const accessLevel = document.getElementById('sidebarAccessLevel');
  const accessDescription = document.getElementById('sidebarAccessDescription');
  const access = ACCESS_SCOPE_BY_ROLE[roleKey];
  if (accessSection) accessSection.hidden = !access;
  if (access && accessLevel && accessDescription) {
    accessLevel.textContent = t(access.level);
    accessDescription.textContent = t(access.description);
  }
}

function updateHeroBanner(roleKey) {
  const titleEl = document.getElementById('heroBannerTitle');
  const subEl = document.getElementById('heroBannerSubtitle');
  if (!titleEl || !subEl) return;

  if (roleKey === 'top_management') {
    titleEl.textContent = t('hero.tm_title');
    subEl.textContent = t('hero.tm_sub');
  } else if (roleKey === 'farm_technician') {
    titleEl.textContent = t('hero.ft_title');
    subEl.textContent = t('hero.ft_sub');
  } else if (roleKey === 'production_manager') {
    titleEl.textContent = t('hero.pm_title');
    subEl.textContent = t('hero.pm_sub');
  } else if (roleKey === 'administrator') {
    titleEl.textContent = t('hero.adm_title');
    subEl.textContent = t('hero.adm_sub');
  } else if (OPS_PANEL_ROLES.includes(roleKey)) {
    // Spec §3.1: dashboard title + logged-in user's name + role in parentheses
    const name = AppState.currentUser ? AppState.currentUser.name : '';
    titleEl.textContent = `${t('hero.ops_title')} — ${name} (${t('roles.' + roleKey)})`;
    subEl.textContent = t('hero.ops_sub_' + roleKey);
  } else if (OPS_ENTRY_ROLES.includes(roleKey)) {
    const name = AppState.currentUser ? AppState.currentUser.name : '';
    titleEl.textContent = `${t('hero.entry_title')} — ${name} (${t('roles.' + roleKey)})`;
    subEl.textContent = t('hero.entry_sub');
  }
}

function switchTab(tabId) {
  AppState.currentTab = tabId;

  // Update sidebar active class
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Hide all tab panes in active interface and show selected pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const targetPane = document.getElementById(`pane_${tabId}`);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  // GIS plot map: initialize/refresh when a map tab becomes visible (Leaflet
  // needs a visible container to compute its size). The API enforces the
  // editor/executive boundary; the mode here is presentation only.
  if (typeof FarmMap !== 'undefined') {
    if (tabId === 'ft_map') FarmMap.initEditor('ftMapEditor');
    else if (tabId === 'pm_map') FarmMap.initEditor('pmMapEditor');
    else if (tabId === 'tm_fields') FarmMap.initReadOnly('tmMapReadOnly');
  }
}

/* ==========================================================================
   Data Rendering per Role Interface (100% Localized Tables)
   ========================================================================== */
function renderDataForRole(roleKey) {
  if (roleKey === 'top_management') {
    renderInvestorOverview();
    renderTmOverviewTable();
    renderTmYieldTable();
    renderTmFieldsGrid();
  } else if (roleKey === 'farm_technician') {
    renderFtMyFields();
    renderFtSyncStatusTable();
  } else if (roleKey === 'production_manager') {
    renderPmReviewQueue();
    renderPmCropCycles();
    renderPmAssignments();
    renderPmScorecardTable();
  } else if (roleKey === 'administrator') {
    renderAdmEmployeesTable();
    renderAdmFieldsMetadataTable();
    renderAdmAuditLogTable();
    renderClimateThresholds(); // ClimateAlertThreshold editor (§5)
  } else if (OPS_PANEL_ROLES.includes(roleKey)) {
    renderOpsDashboard(roleKey);
    renderClimateThresholds(); // Admin Operations → Settings (§5); no-ops for other roles
  } else if (OPS_ENTRY_ROLES.includes(roleKey)) {
    renderOpsEntryInterface(roleKey);
  }
}

/* --- 1. Top Management Renderers --- */
function investorMetrics() {
  const rows = Array.isArray(MECUZI_DATA.yieldData) ? MECUZI_DATA.yieldData : [];
  const outputKg = rows.reduce((sum, row) => sum + Number(row.cajuKg || 0) + Number(row.feijaoKg || 0), 0);
  const targetKg = rows.reduce((sum, row) => sum + Number(row.targetKg || 0), 0);
  const recordedValue = rows.reduce((sum, row) => sum + Number(row.totalValueMzn || 0), 0);
  const recordedCosts = (MECUZI_DATA.opsCostEntries || []).reduce((sum, row) => sum + Number(row.totalMzn || 0), 0);
  const fields = MECUZI_DATA.fields || [];
  return { rows, outputKg, targetKg, recordedValue, recordedCosts, fields, areaHa: fields.reduce((s, f) => s + Number(f.areaHa || 0), 0), cajuKg: rows.reduce((s, r) => s + Number(r.cajuKg || 0), 0), feijaoKg: rows.reduce((s, r) => s + Number(r.feijaoKg || 0), 0) };
}

function investorKpi(label, value, note, status = 'recorded') {
  return `<article class="investor-kpi"><span class="kpi-label">${label}</span><strong>${value}</strong><span class="kpi-note"><i class="status-dot ${status}"></i>${note}</span></article>`;
}

function renderInvestorOverview() {
  const kpiEl = document.getElementById('investorKpis');
  if (!kpiEl) return;
  const m = investorMetrics();
  const attainment = m.targetKg ? m.outputKg / m.targetKg * 100 : null;
  const variance = m.outputKg - m.targetKg;
  const alerts = (MECUZI_DATA.climateAlerts || []).filter(a => a.severity === 'critical' && !a.resolvedAt);
  const money = value => `MZN ${Number(value).toLocaleString('en-GB')}`;
  const unavailable = t('investor.unavailable');
  kpiEl.innerHTML = [
    investorKpi(t('investor.kpi_output'), `${(m.outputKg / 1000).toFixed(1)} t`, t('investor.recorded_ledger'), 'recorded'),
    investorKpi(t('investor.kpi_attainment'), attainment == null ? unavailable : `${attainment.toFixed(1)}%`, t('investor.calculated_demo'), 'calculated'),
    investorKpi(t('investor.kpi_variance'), `${variance >= 0 ? '+' : ''}${(variance / 1000).toFixed(1)} t`, t('investor.calculated_demo'), 'calculated'),
    investorKpi(t('investor.kpi_value'), money(m.recordedValue), t('investor.recorded_value_note'), 'recorded'),
    investorKpi(t('investor.kpi_footprint'), `${m.fields.length} · ${m.areaHa.toFixed(0)} ha`, t('investor.recorded_fields'), 'recorded'),
    investorKpi(t('investor.kpi_alerts'), String(alerts.length), t('investor.critical_alerts_note'), alerts.length ? 'warning' : 'recorded')
  ].join('');
  const max = Math.max(...m.rows.map(r => Number(r.cajuKg || 0) + Number(r.feijaoKg || 0)), 1);
  const targetMax = Math.max(...m.rows.map(r => Number(r.targetKg || 0)), 1);
  const chart = document.getElementById('investorTrendChart');
  if (chart) chart.innerHTML = m.rows.map(row => { const actual = Number(row.cajuKg || 0) + Number(row.feijaoKg || 0); return `<div class="chart-column"><div class="bar-pair"><span class="bar actual-bar" style="height:${Math.max(8, actual / max * 100)}%" title="${actual.toLocaleString()} kg"></span><span class="bar target-bar" style="height:${Math.max(8, Number(row.targetKg || 0) / targetMax * 100)}%" title="${Number(row.targetKg || 0).toLocaleString()} kg"></span></div><span>${t(row.periodKey).split(' ')[0]}</span></div>`; }).join('');
  const mix = document.getElementById('investorMix');
  if (mix) mix.innerHTML = [['investor.cashew', m.cajuKg], ['investor.beans', m.feijaoKg]].map(([key, value]) => `<div class="mix-row"><div><span>${t(key)}</span><strong>${(value / 1000).toFixed(1)} t</strong></div><div class="mix-track"><span style="width:${m.outputKg ? value / m.outputKg * 100 : 0}%"></span></div><small>${m.outputKg ? (value / m.outputKg * 100).toFixed(1) : '0.0'}%</small></div>`).join('');
  const takeaways = document.getElementById('investorTakeaways');
  if (takeaways) takeaways.innerHTML = [`${t('investor.takeaway_output')} <strong>${attainment == null ? unavailable : attainment.toFixed(1) + '%'}</strong>`, `${t('investor.takeaway_value')} <strong>${money(m.recordedValue)}</strong>`, `${t('investor.takeaway_cost')} <strong>${money(m.recordedCosts)}</strong>`].map(x => `<p>${x}</p>`).join('');
  const quality = document.getElementById('investorQuality');
  if (quality) { const batches = MECUZI_DATA.opsPostharvestBatches || []; const complete = batches.filter(b => String(b.status).includes('concluido')).length; quality.innerHTML = `<div class="compact-stat"><strong>${batches.length}</strong><span>${t('investor.batches_recorded')}</span></div><div class="compact-stat"><strong>${complete}/${batches.length || 0}</strong><span>${t('investor.batches_completed')}</span></div><small>${t('investor.quality_unavailable')}</small>`; }
  const impact = document.getElementById('investorImpact');
  if (impact) impact.innerHTML = `<div class="compact-stat"><strong>${m.areaHa.toFixed(0)} ha</strong><span>${t('investor.active_hectares')}</span></div><div class="compact-stat"><strong>${m.fields.length}</strong><span>${t('investor.active_fields')}</span></div><small>${t('investor.impact_scope')}</small>`;
  const risk = document.getElementById('investorRisk');
  if (risk) risk.innerHTML = alerts.slice(0, 4).map(a => { const field = m.fields.find(f => f.id === a.fieldId); return `<div class="risk-row"><span class="risk-severity">${t('investor.critical')}</span><div><strong>${field ? t(field.nameKey) : a.fieldId}</strong><small>${t(a.messageKey, t('investor.risk_recorded'))}</small></div></div>`; }).join('') || `<small>${t('investor.no_critical_alerts')}</small>`;
  const prov = document.getElementById('investorProvenance');
  if (prov) prov.innerHTML = `<p><strong>${t('investor.source_dataset')}:</strong> ${t('investor.source_dataset_value')}</p><p><strong>${t('investor.calculation')}:</strong> ${t('investor.calculation_value')}</p><p><strong>${t('investor.reporting_period')}:</strong> ${m.rows.length ? `${t(m.rows[0].periodKey)} – ${t(m.rows[m.rows.length - 1].periodKey)}` : unavailable}</p><p><strong>${t('investor.review_status')}:</strong> Demo / Recorded / Pending validation · ${new Date().toLocaleString(currentLocale)}</p>`;
  renderInvestorScenario();
}

function renderInvestorScenario() {
  const result = document.getElementById('investorScenarioResult'); const select = document.getElementById('investorScenarioCase'); const price = document.getElementById('investorPriceAdjustment'); const output = document.getElementById('investorPriceValue');
  if (!result || !select || !price) return;
  const m = investorMetrics(); const factor = select.value === 'higher' ? 1.15 : select.value === 'lower' ? 0.85 : 1; const priceFactor = 1 + Number(price.value) / 100; if (output) output.value = `${price.value}%`;
  result.innerHTML = `<strong>${((m.outputKg * factor) / 1000).toFixed(1)} t</strong><span>${t('investor.scenario_output')}</span><strong>MZN ${(m.recordedValue * factor * priceFactor).toLocaleString('en-GB')}</strong><span>${t('investor.scenario_value')}</span><small>${t('investor.scenario_disclaimer')}</small>`;
}
function renderTmOverviewTable() {
  const tbody = document.getElementById('tmOverviewTableBody');
  if (!tbody) return;

  tbody.innerHTML = MECUZI_DATA.fields.map(f => {
    const statusBadge = f.status === 'on-track' 
      ? `<span class="badge badge-success">${t('status.on_track')}</span>`
      : `<span class="badge badge-warning">${t('status.attention_needed')}</span>`;

    const fieldName = t(f.nameKey);
    const locationName = `${t(f.locationKey)} ${f.coords}`;
    const cropName = t(f.cropKey);

    return `
      <tr>
        <td><strong>${fieldName}</strong> <br><small class="text-muted">${f.id}</small></td>
        <td>${locationName}</td>
        <td><strong>${f.areaHa} ha</strong></td>
        <td>${cropName}</td>
        <td>${f.assignedTechName}</td>
        <td><strong>${(f.yieldForecastKg / 1000).toFixed(1)} Ton</strong></td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function renderTmYieldTable() {
  const tbody = document.getElementById('tmYieldTableBody');
  if (!tbody) return;

  tbody.innerHTML = MECUZI_DATA.yieldData.map(y => {
    const totalKg = y.cajuKg + y.feijaoKg;
    const pct = ((totalKg / y.targetKg) * 100).toFixed(0);
    const badgeClass = totalKg >= y.targetKg ? 'badge-success' : 'badge-warning';
    const periodName = t(y.periodKey);

    return `
      <tr>
        <td><strong>${periodName}</strong></td>
        <td><strong>${y.cajuKg.toLocaleString()} kg</strong></td>
        <td>${y.feijaoKg.toLocaleString()} kg</td>
        <td>${y.targetKg.toLocaleString()} kg</td>
        <td><strong>${y.totalValueMzn.toLocaleString()} MZN</strong></td>
        <td><span class="badge ${badgeClass}">${pct}%</span></td>
      </tr>
    `;
  }).join('');
}

function renderTmFieldsGrid() {
  const container = document.getElementById('tmFieldsGrid');
  if (!container) return;

  container.innerHTML = MECUZI_DATA.fields.map(f => {
    const statusBadge = f.status === 'on-track'
      ? `<span class="badge badge-success">${t('status.on_track')}</span>`
      : `<span class="badge badge-warning">${t('status.attention_needed')}</span>`;

    return `
      <div class="card" style="gap: 0.5rem;">
        <div class="card-header" style="padding-bottom: 0.4rem;">
          <strong style="font-size: 13px; color: var(--color-primary-dark);">${t(f.nameKey)}</strong>
          ${statusBadge}
        </div>
        <div style="font-size: 11px; color: var(--color-text-muted);">${t(f.locationKey)} • ${f.areaHa} ha</div>
        <div style="font-size: 12px; margin-top: 0.2rem;"><strong>${t('tm.th_crop')}:</strong> ${t(f.cropKey)}</div>
        <div style="font-size: 12px;"><strong>${t('tm.th_tech')}:</strong> ${f.assignedTechName}</div>
        <div style="font-size: 12px;"><strong>${t('tm.th_forecast')}:</strong> ${(f.yieldForecastKg / 1000).toFixed(1)} Ton</div>
      </div>
    `;
  }).join('');
}

/* --- 2. Farm Technician Renderers & Handlers --- */
function renderFtMyFields() {
  const container = document.getElementById('ftMyFieldsGrid');
  if (!container) return;

  // Technician sees ONLY their own assigned fields (ACCESS_CONTROL_FIX.md §3.2)
  const myTechId = AppState.claims ? AppState.claims.sub : 'TZ11244045';
  const badge = document.getElementById('ftTechnicianBadge');
  if (badge && AppState.currentUser) {
    badge.textContent = `${AppState.currentUser.name} (${myTechId})`;
  }
  const myFields = MECUZI_DATA.fields.filter(f => f.assignedTechId === myTechId);

  container.innerHTML = myFields.map(f => `
    <div class="card" style="gap: 0.6rem;">
      <div class="card-header" style="padding-bottom: 0.4rem;">
        <strong style="font-size: 13px; color: var(--color-primary-dark);">${t(f.nameKey)}</strong>
        <span class="badge badge-success">${f.areaHa} ha</span>
      </div>
      <div style="font-size: 12px;"><strong>${t('tm.th_crop')}:</strong> ${t(f.cropKey)}</div>
      <div style="font-size: 12px;"><strong>${t('adm.th_water_source')}:</strong> ${t(f.waterSourceKey)}</div>
      <div style="margin-top: 0.5rem;">
        <button class="btn btn-primary btn-sm" onclick="switchTab('ft_newreport')">${t('ft.btn_new_field_report')}</button>
      </div>
    </div>
  `).join('');
}

function renderFieldSelectOptions() {
  const sel = document.getElementById('reportFieldSelect');
  if (!sel) return;
  sel.innerHTML = MECUZI_DATA.fields.slice(0, 2).map(f => `
    <option value="${f.id}">${t(f.nameKey)} (${f.areaHa} ha)</option>
  `).join('');
}

function selectReportType(type, btnEl) {
  document.querySelectorAll('.touch-type-btn').forEach(btn => btn.classList.remove('active'));
  btnEl.classList.add('active');
  const input = document.getElementById('reportTypeInput');
  if (input) input.value = type;
}

function simulateCameraCapture() {
  AppState.attachedPhoto = 'images/cashews-thumb.png';
  const nameEl = document.getElementById('photoFileName');
  const box = document.getElementById('cameraBox');
  if (nameEl) nameEl.textContent = t('ft.photo_attached');
  if (box) box.style.borderColor = 'var(--color-primary)';
  showToast(t('ft.photo_attached'), 'success');
}

async function handleFieldReportSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('reportTypeInput')?.value || 'harvest';
  const fieldId = document.getElementById('reportFieldSelect')?.value || 'FLD-01';
  const qty = parseFloat(document.getElementById('reportQtyInput')?.value || 0);
  const notes = document.getElementById('reportNotesInput')?.value || '';

  const clientUuid = `REP-UUID-${Math.floor(1000 + Math.random() * 9000)}`;
  const fieldObj = MECUZI_DATA.fields.find(f => f.id === fieldId);

  const newReport = {
    id: clientUuid,
    fieldId: fieldId,
    fieldNameKey: fieldObj ? fieldObj.nameKey : 'fields.fld_01_name',
    technicianId: AppState.claims ? AppState.claims.sub : null, // server re-attributes anyway
    technicianName: AppState.currentUser ? AppState.currentUser.name : '',
    reportType: type,
    data: {
      qtyKg: qty,
      notes: notes,
      notesKey: ''
    },
    photoUrl: AppState.attachedPhoto || 'images/cashews-thumb.png',
    submittedAt: new Date().toLocaleDateString('pt-PT') + ' ' + new Date().toLocaleTimeString().slice(0, 5),
    syncStatus: AppState.isOffline ? 'pending' : 'synced',
    reviewStatus: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    reviewNotesKey: ''
  };

  // POST /field-reports — the API enforces the farm_technician role from the JWT (§2.4)
  const res = await MockAPI.createFieldReport(AppState.accessToken, newReport);
  if (!res.ok) {
    showToast(t(res.error), 'error');
    return;
  }

  // Reset form
  document.getElementById('reportQtyInput').value = '';
  document.getElementById('reportNotesInput').value = '';
  AppState.attachedPhoto = null;
  const nameEl = document.getElementById('photoFileName');
  if (nameEl) nameEl.textContent = t('ft.no_photo_attached');

  showToast(`${clientUuid} — ${t('ft.btn_save_device')}`, 'success');
  renderFtSyncStatusTable();
  switchTab('ft_syncstatus');
}

function renderFtSyncStatusTable() {
  const tbody = document.getElementById('ftSyncStatusTableBody');
  if (!tbody) return;

  const reportRows = MECUZI_DATA.fieldReports.map(r => {
    const syncBadge = r.syncStatus === 'synced'
      ? `<span class="badge badge-success">${t('status.synced')}</span>`
      : `<span class="badge badge-warning">${t('status.saved_device')}</span>`;

    const reviewBadge = r.reviewStatus === 'approved'
      ? `<span class="badge badge-success">${t('status.approved')}</span>`
      : (r.reviewStatus === 'flagged'
          ? `<span class="badge badge-danger">${t('status.flagged')}</span>`
          : `<span class="badge badge-neutral">${t('status.pending_review')}</span>`);

    return `
      <tr>
        <td><strong>${r.id}</strong></td>
        <td>${t(r.fieldNameKey)}</td>
        <td><span class="badge badge-neutral">${t('report_types.' + r.reportType)}</span></td>
        <td>${r.submittedAt}</td>
        <td>${syncBadge}</td>
        <td>${reviewBadge}</td>
      </tr>
    `;
  }).join('');

  // Manual fire reports share this sync queue (§2.4) — a pending row here is
  // a fire report filed offline whose critical alert fires when it syncs.
  const myId = AppState.claims ? AppState.claims.sub : null;
  const fireRows = MECUZI_DATA.fireHotspots
    .filter(h => h.source === 'human_report' && h.reportedBy === myId)
    .map(h => {
      const field = MECUZI_DATA.fields.find(f => f.id === h.fieldId);
      const syncBadge = h.syncStatus === 'synced'
        ? `<span class="badge badge-success">${t('status.synced')}</span>`
        : `<span class="badge badge-warning">${t('status.saved_device')}</span>`;
      return `
      <tr>
        <td><strong>${h.id}</strong></td>
        <td>${field ? t(field.nameKey) : '—'}</td>
        <td><span class="badge badge-danger">${t('fire.btn_report')}</span></td>
        <td>${h.detectedAt.slice(0, 16).replace('T', ' ')}</td>
        <td>${syncBadge}</td>
        <td><span class="badge badge-danger">${t('climate.sev_critical')}</span></td>
      </tr>`;
    }).join('');

  tbody.innerHTML = fireRows + reportRows;
}

async function triggerBatchSync() {
  showToast(t('ft.btn_sync_all') + ' (POST /sync/field-reports)...', 'navy');
  // POST /sync/field-reports — API enforces farm_technician from the JWT (§2.4)
  const res = await MockAPI.syncFieldReports(AppState.accessToken);
  if (!res.ok) {
    showToast(t(res.error), 'error');
    return;
  }
  // Queued offline fire reports sync in the same batch — and their critical
  // alert + SMS fire AT SYNC TIME, not on the next scheduled cycle (§5, §12)
  const fireRes = await MockAPI.syncFireReports(AppState.accessToken);
  setTimeout(() => {
    renderFtSyncStatusTable();
    showToast(t('status.synced'), 'success');
    if (fireRes.ok && fireRes.data.synced > 0) {
      showToast(t('fire.alert_raised'), 'error');
      renderClimateAlerts();
    }
  }, 900);
}

/* --- 3. Production Manager Renderers & Handlers --- */
function renderPmReviewQueue() {
  const tbody = document.getElementById('pmReviewTableBody');
  if (!tbody) return;

  tbody.innerHTML = MECUZI_DATA.fieldReports.map(r => {
    const qtyText = r.data.qtyKg ? `${r.data.qtyKg} kg` : (t(r.data.issueTypeKey) || t('report_types.' + r.reportType));
    const notesText = r.data.notesKey ? t(r.data.notesKey) : (r.data.notes || '—');
    let actionsHtml = '';

    if (r.reviewStatus === 'approved') {
      actionsHtml = `<span class="badge badge-success">${t('status.approved')}</span>`;
    } else if (r.reviewStatus === 'flagged') {
      actionsHtml = `<span class="badge badge-danger">${t('status.flagged')}</span>`;
    } else {
      actionsHtml = `
        <div style="display: flex; gap: 0.35rem;">
          <button class="btn btn-success btn-sm" onclick="approveReport('${r.id}')">${t('pm.btn_approve')}</button>
          <button class="btn btn-danger btn-sm" onclick="flagReport('${r.id}')">${t('pm.btn_flag')}</button>
        </div>
      `;
    }

    return `
      <tr>
        <td><strong>${r.id}</strong><br><small class="text-muted">${r.submittedAt}</small></td>
        <td>${r.technicianName}</td>
        <td>${t(r.fieldNameKey)}</td>
        <td><span class="badge badge-neutral">${t('report_types.' + r.reportType)}</span> <strong>${qtyText}</strong></td>
        <td><small>${notesText}</small></td>
        <td>${actionsHtml}</td>
      </tr>
    `;
  }).join('');
}

async function approveReport(reportId) {
  // PATCH /field-reports/:id/review — API enforces production_manager from the JWT
  const res = await MockAPI.reviewFieldReport(AppState.accessToken, reportId, 'approved');
  if (!res.ok) {
    showToast(t(res.error), 'error');
    return;
  }
  showToast(`${reportId} — ${t('status.approved')}`, 'success');
  renderPmReviewQueue();
}

async function flagReport(reportId) {
  const res = await MockAPI.reviewFieldReport(AppState.accessToken, reportId, 'flagged');
  if (!res.ok) {
    showToast(t(res.error), 'error');
    return;
  }
  showToast(`${reportId} — ${t('status.flagged')}`, 'warning');
  renderPmReviewQueue();
}

function renderPmCropCycles() {
  const tbody = document.getElementById('pmCropCyclesTableBody');
  if (!tbody) return;

  tbody.innerHTML = MECUZI_DATA.cropCycles.map(c => `
    <tr>
      <td><strong>${c.id}</strong></td>
      <td>${t(c.fieldNameKey)}</td>
      <td>${t(c.cropKey)}</td>
      <td>${c.plantingDate}</td>
      <td><strong>${c.expectedHarvestDate}</strong></td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <div style="width: 80px; background: #E2E8DE; border-radius: 999px; height: 8px;">
            <div style="width: ${c.progressPercent}%; background: var(--color-primary); height: 100%; border-radius: 999px;"></div>
          </div>
          <small>${c.progressPercent}%</small>
        </div>
      </td>
      <td><span class="badge badge-success">${t(c.statusKey)}</span></td>
    </tr>
  `).join('');
}

function renderPmAssignments() {
  const tbody = document.getElementById('pmAssignmentsTableBody');
  if (!tbody) return;

  tbody.innerHTML = MECUZI_DATA.fields.map(f => `
    <tr>
      <td><strong>${t(f.nameKey)}</strong></td>
      <td>${f.areaHa} ha</td>
      <td>${t(f.locationKey)}</td>
      <td><span class="badge badge-neutral">${f.assignedTechName}</span></td>
      <td>
        <select class="form-control" style="font-size: 11px; padding: 0.2rem;" onchange="showToast('Reassigned: ' + this.options[this.selectedIndex].text, 'success')">
          <option value="TZ11244045" ${f.assignedTechId === 'TZ11244045' ? 'selected' : ''}>Daniel Sitoe (TZ11244045)</option>
          <option value="TZ11244046" ${f.assignedTechId === 'TZ11244046' ? 'selected' : ''}>Luisa Banze (TZ11244046)</option>
          <option value="TZ11244047" ${f.assignedTechId === 'TZ11244047' ? 'selected' : ''}>Samuel Matusse (TZ11244047)</option>
        </select>
      </td>
    </tr>
  `).join('');
}

function renderPmScorecardTable() {
  const tbody = document.getElementById('pmScorecardTableBody');
  if (!tbody) return;

  const scorecards = [
    { name: 'Daniel Sitoe', empNo: 'TZ11244045', pointKey: 'fields.fld_01_loc', punctuality: '98.2%', grade: 'A', score: '96 / 100' },
    { name: 'Luisa Banze', empNo: 'TZ11244046', pointKey: 'fields.fld_03_loc', punctuality: '95.0%', grade: 'A', score: '92 / 100' },
    { name: 'Samuel Matusse', empNo: 'TZ11244047', pointKey: 'fields.fld_05_loc', punctuality: '89.4%', grade: 'B', score: '85 / 100' }
  ];

  tbody.innerHTML = scorecards.map(s => {
    const gradeBadge = s.grade === 'A'
      ? `<span class="badge badge-success">${currentLocale === 'zh-TW' ? 'A級 (優良)' : (currentLocale === 'en-GB' ? 'Grade A' : 'Grau A')}</span>`
      : `<span class="badge badge-warning">${currentLocale === 'zh-TW' ? 'B級 (良好)' : (currentLocale === 'en-GB' ? 'Grade B' : 'Grau B')}</span>`;

    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.empNo}</td>
        <td>${t(s.pointKey)}</td>
        <td>${s.punctuality}</td>
        <td>${gradeBadge}</td>
        <td><strong>${s.score}</strong></td>
      </tr>
    `;
  }).join('');
}

/* --- 4. Administration Renderers & Handlers --- */
function renderAdmEmployeesTable() {
  const tbody = document.getElementById('admEmployeesTableBody');
  if (!tbody) return;

  tbody.innerHTML = MECUZI_DATA.employees.map(emp => {
    const statusBadge = emp.status === 'active'
      ? `<span class="badge badge-success">${t('status.active')}</span>`
      : `<span class="badge badge-warning">${t('status.pending')}</span>`;

    return `
      <tr>
        <td><strong>${emp.employeeNumber}</strong> <br><small class="text-muted">${emp.id}</small></td>
        <td><strong>${emp.name}</strong></td>
        <td>${emp.phone}</td>
        <td><span class="badge badge-neutral">${t(emp.roleKey || ('roles.' + emp.role))}</span></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="resetEmployeePin('${emp.employeeNumber}')">${t('adm.btn_reset_pin')}</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function resetEmployeePin(empNumber) {
  // POST /employees/:id/reset-pin — API enforces administrator from the JWT
  const res = await MockAPI.resetEmployeePin(AppState.accessToken, empNumber);
  if (!res.ok) {
    showToast(t(res.error), 'error');
    return;
  }
  showToast(`${t('adm.btn_reset_pin')}: ${res.data.name} (${empNumber}).`, 'success');
  renderAdmEmployeesTable();
  renderAdmAuditLogTable();
}

async function showProvisionEmployeeModal() {
  const empNum = `TZ112440${Math.floor(48 + Math.random() * 10)}`;
  const name = prompt(t('adm.th_full_name') + ':');
  if (!name) return;

  const phone = prompt(t('adm.th_phone_otp') + ' (+258):', '+258 84 999 0000');

  // Role is assigned by the Administrator at creation — the ONLY place this
  // happens (ACCESS_CONTROL_FIX.md §3.0). All 12 roles are provisionable here.
  const roleInput = prompt(
    t('adm.th_system_role') + ':\n' + MockAPI.ROLES.join(', '), 'farm_technician');
  const role = MockAPI.ROLES.includes(roleInput) ? roleInput : 'farm_technician';

  // POST /employees — the ONLY place a role is assigned, by an Administrator (§3.0)
  const res = await MockAPI.createEmployee(AppState.accessToken, {
    employeeNumber: empNum,
    name: name,
    phone: phone || '+258 84 000 0000',
    role: role,
    point: 'Point_A',
    assignedFields: ['FLD-01']
  });
  if (!res.ok) {
    showToast(t(res.error), 'error');
    return;
  }

  showToast(`${t('adm.btn_create_employee')}: ${name} (${empNum})`, 'success');
  renderAdmEmployeesTable();
  renderAdmAuditLogTable();
}

function renderAdmFieldsMetadataTable() {
  const tbody = document.getElementById('admFieldsMetadataTableBody');
  if (!tbody) return;

  tbody.innerHTML = MECUZI_DATA.fields.map(f => `
    <tr>
      <td><strong>${f.id}</strong></td>
      <td><strong>${t(f.nameKey)}</strong></td>
      <td><small>${t(f.locationKey)} ${f.coords}</small></td>
      <td>${f.areaHa} ha</td>
      <td><span class="badge badge-neutral">${t(f.waterSourceKey)}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="showToast(t('adm.btn_edit') + ': ' + '${f.id}', 'navy')">${t('adm.btn_edit')}</button></td>
    </tr>
  `).join('');
}

function renderAdmAuditLogTable(filterTerm = '') {
  const tbody = document.getElementById('admAuditLogTableBody');
  if (!tbody) return;

  let logs = MECUZI_DATA.auditLogs;
  if (filterTerm) {
    const term = filterTerm.toLowerCase();
    logs = logs.filter(l => l.actor.toLowerCase().includes(term) || t(l.actionKey).toLowerCase().includes(term) || t(l.metadataKey).toLowerCase().includes(term));
  }

  tbody.innerHTML = logs.map(l => {
    let actionBadge = `<span class="badge badge-neutral">${t(l.actionKey)}</span>`;
    if (l.actionKey.includes('APPROVED')) actionBadge = `<span class="badge badge-success">${t(l.actionKey)}</span>`;
    if (l.actionKey.includes('RESET') || l.actionKey.includes('FLAGGED')) actionBadge = `<span class="badge badge-warning">${t(l.actionKey)}</span>`;

    return `
      <tr>
        <td><strong>${l.id}</strong></td>
        <td><small>${l.timestamp}</small></td>
        <td><strong>${l.actor}</strong></td>
        <td>${actionBadge}</td>
        <td>${l.targetEntity} (${l.targetId})</td>
        <td><small>${t(l.metadataKey)}</small></td>
      </tr>
    `;
  }).join('');
}

function filterAuditLogs() {
  const input = document.getElementById('auditSearchInput');
  const term = input ? input.value : '';
  renderAdmAuditLogTable(term);
}

/* ==========================================================================
   Authentication Flow (demo account selector)
   Opaque selection ID → HttpOnly signed cookie → automatic dashboard.
   ========================================================================== */
function openAuthModal() {
  const modal = document.getElementById('authModalBackdrop');
  if (modal) modal.classList.add('open');
  showAuthStep(1);
}

function closeAuthModal() {
  // The login/OTP modal cannot be dismissed before a session exists —
  // there is no accessible content behind it anyway (body:not(.authenticated)).
  if (!AppState.accessToken) return;
  const modal = document.getElementById('authModalBackdrop');
  if (modal) modal.classList.remove('open');
}

function showAuthStep(stepNumber) {
  const step1 = document.getElementById('authStep1');
  if (step1) step1.style.display = stepNumber === 1 ? 'block' : 'none';

  const titleEl = document.getElementById('authStepTitle');
  const subEl = document.getElementById('authStepSubtitle');

  if (stepNumber === 1) {
    if (titleEl) titleEl.textContent = t('auth.demo.title');
    if (subEl) subEl.textContent = t('auth.demo.instructions');
  }
}

// Demo selector — POST /api/auth/demo-login: opaque selection ID -> server session
async function handleAuthSubmitStep1() {
  const selectionId = document.getElementById('demoAccountSelect')?.value;
  if (!selectionId) return;

  const res = await MockAPI.demoLogin(selectionId);
  if (!res.ok) {
    showToast(t(res.error), 'error');
    return;
  }

  establishSession(res.data.session, res.data.employee);
}

async function loadDemoAccounts() {
  const select = document.getElementById('demoAccountSelect');
  if (!select) return;
  const res = await MockAPI.demoAccounts();
  if (!res.ok) {
    const error = document.getElementById('demoAccountError');
    if (error) error.style.display = 'block';
    return;
  }
  select.querySelectorAll('option:not(:first-child)').forEach(option => option.remove());
  res.data.accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.selectionId;
    option.textContent = t(account.labelKey);
    option.dataset.i18n = account.labelKey;
    select.appendChild(option);
  });
}

// Session established: retain only public server-derived claims in memory, then
// route automatically to the role returned by /api/auth/session.
async function establishSession(sessionClaims, employee) {
  const auth = await MockAPI.verifyAccessToken(sessionClaims);
  if (!auth.ok) {
    showToast(t(auth.error), 'error');
    return;
  }
  AppState.accessToken = auth.claims;
  AppState.claims = auth.claims;
  AppState.currentUser = MECUZI_DATA.employees.find(e => e.employeeNumber === auth.claims.sub) || employee || {
    employeeNumber: auth.claims.sub,
    name: auth.claims.name,
    role: auth.claims.role,
    roleKey: auth.claims.roleKey,
    status: auth.claims.status || 'active'
  };

  document.body.classList.add('authenticated');
  updateAccountUi();
  closeAuthModal();

  showToast(`${auth.claims.name} — ${t('roles.' + auth.claims.role)}`, 'success');
  routeToRoleDashboard(auth.claims.role);

  // Monthly budget-submission reminder — deadline day 20 (spec §8, responsibility #1)
  if (auth.claims.role === 'admin_manager') {
    const day = new Date().getDate();
    if (day <= 20) {
      showToast(`${t('alerts.budget_chip')} — ${t('ops.budget_reminder')}`, 'warning');
    }
  }

  // Climate ingestion cycle (WEATHER_INTEGRATION_SPEC.md §4): on the real
  // backend these are BullMQ jobs — weather every 6h, FIRMS every 3h, fire
  // danger right after weather. This client build runs one cycle at login;
  // failures degrade gracefully and never block the dashboard (§11).
  try {
    await MockAPI.runClimateIngestion({ batchDelayMs: 0 });
  } catch (e) { /* external API down — seeded data keeps serving (§11) */ }
  renderClimateAlerts();
}

/* ==========================================================================
   Offline / Online Simulator
   ========================================================================== */
function toggleOfflineMode() {
  AppState.isOffline = !AppState.isOffline;
  const chip = document.getElementById('connectivityChip');
  const text = document.getElementById('connectivityText');
  const formBadge = document.getElementById('ftFormOfflineBadge');

  if (AppState.isOffline) {
    if (chip) chip.classList.add('offline');
    if (text) text.textContent = t('app.offline_status');
    if (formBadge) formBadge.textContent = t('ft.badge_offline_safe');
    showToast(t('app.offline_status'), 'warning');
  } else {
    if (chip) chip.classList.remove('offline');
    if (text) text.textContent = t('app.online_status');
    if (formBadge) formBadge.textContent = t('app.online_status');
    showToast(t('app.online_status'), 'success');
  }
}

/* ==========================================================================
   Alert Bar Toggle & Handlers
   ========================================================================== */
function setupAlertBarToggle() {
  const alertBar = document.getElementById('topAlertBar');
  const toggleBtn = document.getElementById('toggleAlertsBtn');
  const alertHeader = document.getElementById('alertBarHeader');

  if (!alertBar || !alertHeader) return;

  const toggleBar = (e) => {
    if (e.target.classList.contains('alert-ticker-chip')) return;
    alertBar.classList.toggle('open');
  };

  if (toggleBtn) toggleBtn.addEventListener('click', toggleBar);
  alertHeader.addEventListener('click', toggleBar);
}

function handleAlertClick(alertType) {
  // Alerts navigate WITHIN the current session's own dashboard only — the role
  // guard would redirect any cross-role jump anyway (ACCESS_CONTROL_FIX.md §2.3).
  const sessionRole = AppState.claims ? AppState.claims.role : null;
  const goIfOwn = (role, tab) => {
    if (sessionRole === role) switchTab(tab);
  };

  if (alertType === 'water') {
    goIfOwn('top_management', 'tm_fields');
    goIfOwn('farm_technician', 'ft_newreport');
    goIfOwn('operations_support_lead', 'ops_operations');
    goIfOwn('admin_manager', 'ops_operations');
    showToast(t('alerts.water_desc'), 'warning');
  } else if (alertType === 'mech') {
    goIfOwn('production_manager', 'pm_reports');
    goIfOwn('operations_support_lead', 'ops_operations');
    goIfOwn('admin_manager', 'ops_operations');
    showToast(t('alerts.mech_desc'), 'error');
  } else if (alertType === 'coverage') {
    goIfOwn('administrator', 'adm_employees');
    goIfOwn('hr_facility_lead', 'ops_hr');
    showToast(t('alerts.coverage_desc'), 'warning');
  } else if (alertType === 'fuel') {
    goIfOwn('top_management', 'tm_overview');
    goIfOwn('finance_compliance_lead', 'ops_finance');
    showToast(t('alerts.fuel_desc'), 'warning');
  } else if (alertType === 'budget') {
    goIfOwn('admin_manager', 'ops_finance');
    showToast(t('alerts.budget_desc'), 'warning');
  }
}

/* ==========================================================================
   Administrative Operations — Section Renderers & Handlers (spec §4–§8)
   All data comes through MockAPI, which enforces unit scoping server-side;
   these renderers are presentation only.
   ========================================================================== */
function opsBadgeClass(val) {
  // Classify by the raw value (i18n key like 'v.pendente'), never by the
  // translated label, so colors are stable across all 3 locales.
  const v = String(val);
  if (/(v\.pago|v\.aprovado|v\.conforme|v\.ok|v\.concluido|v\.distribuido|v\.submetido|v\.pronto|v\.servido|v\.encaminhado|v\.normal)$/.test(v)) return 'badge-success';
  if (/(v\.rejeitado|v\.excedido|v\.anomalia_120|v\.divergencia|v\.alta)$/.test(v)) return 'badge-danger';
  if (/(v\.pendente|v\.parcial|v\.em_curso|v\.agendado|v\.stock_baixo|v\.repor_breve|v\.rascunho|v\.media|v\.saida|v\.envio_mensal|v\.desvio_15)$/.test(v)) return 'badge-warning';
  return 'badge-neutral';
}

// Values may be i18n keys (v.*, d.*, fields.*, water.*) or free text;
// t() passes non-key strings through unchanged, so translate uniformly.
function trVal(val) {
  return typeof val === 'string' ? t(val) : val;
}

function fmtOpsCell(col, row) {
  const raw = row[col.f];
  if (col.fmt === 'mzn') return `<strong>${Number(raw).toLocaleString('pt-PT')} MZN</strong>`;
  if (col.fmt === 'pct') return `${raw}%`;
  if (col.fmt === 'badge') return `<span class="badge ${opsBadgeClass(raw)}">${trVal(raw)}</span>`;
  return raw == null ? '—' : trVal(raw);
}

async function renderOpsDashboard(role) {
  const sections = OPS_ROLE_SECTIONS[role] || [];
  if (role === 'admin_manager') {
    await renderOpsOverview();
  }
  if (sections.includes('finance')) await renderOpsSection('finance', 'opsFinanceContent', role);
  if (sections.includes('operations')) await renderOpsSection('operations', 'opsOperationsContent', role);
  if (sections.includes('hr_services')) await renderOpsSection('hr_services', 'opsHrContent', role);
}

async function renderOpsSection(sectionKey, containerId, role) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = '';

  for (const view of OPS_SECTIONS[sectionKey]) {
    const res = await MockAPI.listUnitRecords(AppState.accessToken, view.entity);
    if (!res.ok) {
      // Should never happen for a correctly scoped role — the API said no (403)
      html += `<div class="card"><div class="card-header"><span class="card-title">${t(view.titleKey)}</span>
        <span class="badge badge-danger">${t(res.error)}</span></div></div>`;
      continue;
    }
    const sensitiveBadge = view.sensitive
      ? `<span class="badge badge-danger">${t('ops.sensitive_badge')}</span>` : '';
    // Sensitive entities (wellbeing) get NO export button — §6.1.3/§10
    const exportBtn = view.sensitive ? '' :
      `<button class="btn btn-secondary btn-sm" onclick="exportOpsTable('${view.entity}')">${t('ops.btn_export_excel')}</button>`;
    const head = view.cols.map(c => `<th>${t(c.h)}</th>`).join('') +
      (view.reviewable ? `<th>${t('pm.th_actions')}</th>` : '');
    const body = res.data.map(row => {
      const cells = view.cols.map(c => `<td>${fmtOpsCell(c, row)}</td>`).join('');
      let actions = '';
      if (view.reviewable) {
        actions = row.status === 'v.pendente'
          ? `<td><div style="display:flex;gap:0.35rem;">
               <button class="btn btn-success btn-sm" onclick="reviewOpsRecord('${view.entity}','${row.id}','v.aprovado','${sectionKey}')">${t('pm.btn_approve')}</button>
               <button class="btn btn-danger btn-sm" onclick="reviewOpsRecord('${view.entity}','${row.id}','v.rejeitado','${sectionKey}')">${t('ops.btn_reject')}</button>
             </div></td>`
          : `<td><span class="badge ${opsBadgeClass(row.status)}">${trVal(row.status)}</span></td>`;
      }
      return `<tr>${cells}${actions}</tr>`;
    }).join('');

    html += `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${t(view.titleKey)}</span>
          <div style="display:flex;gap:0.4rem;align-items:center;">
            ${sensitiveBadge}
            ${exportBtn}
          </div>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
  }

  // Unit leads also supervise their subordinate roles' submissions (§5.1.9, §7.1)
  if (sectionKey === 'operations' || sectionKey === 'hr_services') {
    html += await buildOpsSupervisionQueueHtml(sectionKey);
  }
  // Operations Support: rainfall cross-referenced against existing borehole
  // readings (WEATHER_INTEGRATION_SPEC.md §7) — flags boreholes not
  // responding as expected to recent rain.
  if (sectionKey === 'operations') {
    html += await buildRainfallBoreholeCardHtml();
  }
  container.innerHTML = html;
}

async function buildRainfallBoreholeCardHtml() {
  const res = await MockAPI.getRainfallBoreholeCorrelation(AppState.accessToken);
  if (!res.ok) return ''; // role not permitted — render nothing, never crash
  const rows = res.data.map(r => {
    const badgeClass = r.statusKey === 'climate.corr_ok' ? 'badge-success'
      : (r.statusKey === 'climate.corr_no_data' ? 'badge-neutral' : 'badge-danger');
    return `<tr>
      <td><strong>${t(r.borehole)}</strong><br><small class="text-muted">${r.fieldId}</small></td>
      <td>${r.recentRainMm == null ? '—' : `<strong>${r.recentRainMm} mm</strong>`}</td>
      <td>${r.readingM3} m³</td>
      <td>${r.avgM3} m³</td>
      <td><span class="badge ${badgeClass}">${t(r.statusKey)}</span></td>
    </tr>`;
  }).join('');
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${t('climate.corr_title')}</span>
        <span class="badge badge-neutral">Open-Meteo × BoreholeReading</span>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead><tr>
            <th>${t('ops.th.borehole')}</th><th>${t('climate.corr_rain')}</th>
            <th>${t('ops.th.reading')}</th><th>${t('ops.th.avg')}</th><th>${t('ops.th.status')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

async function buildOpsSupervisionQueueHtml(sectionKey) {
  const res = await MockAPI.listOpsSubmissions(AppState.accessToken);
  if (!res.ok) return '';
  const rows = res.data.map(e => {
    const dataText = Object.entries(e.data).map(([k, v]) => `${k}: ${trVal(v)}`).join(' · ');
    const reviewBadge = e.reviewStatus === 'approved'
      ? `<span class="badge badge-success">${t('status.approved')}</span>`
      : (e.reviewStatus === 'flagged'
          ? `<span class="badge badge-danger">${t('status.flagged')}</span>`
          : `<div style="display:flex;gap:0.35rem;">
               <button class="btn btn-success btn-sm" onclick="reviewOpsEntry('${e.id}','approved','${sectionKey}')">${t('pm.btn_approve')}</button>
               <button class="btn btn-danger btn-sm" onclick="reviewOpsEntry('${e.id}','flagged','${sectionKey}')">${t('pm.btn_flag')}</button>
             </div>`);
    return `<tr>
      <td><strong>${e.id}</strong><br><small class="text-muted">${e.submittedAt}</small></td>
      <td>${e.submittedByName}</td>
      <td><span class="badge badge-neutral">${t('entry.form_' + formIdToKey(e.formId))}</span></td>
      <td><small>${dataText}</small></td>
      <td>${reviewBadge}</td>
    </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${t('ops.supervision_title')}</span>
        <div style="display:flex;gap:0.4rem;align-items:center;">
          <span class="badge badge-warning">${t('pm.badge_mandatory_approval')}</span>
          <button class="btn btn-secondary btn-sm" onclick="exportOpsQueue('${sectionKey}')">${t('ops.btn_export_excel')}</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead><tr>
            <th>${t('pm.th_id_date')}</th><th>${t('ops.th_submitter')}</th>
            <th>${t('entry.th_form')}</th><th>${t('ops.th_data')}</th><th>${t('pm.th_actions')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function formIdToKey(formId) {
  return formId; // form titles live at entry.form_<formId>
}

async function reviewOpsRecord(entity, recordId, decision, sectionKey) {
  const res = await MockAPI.reviewUnitRecord(AppState.accessToken, entity, recordId, decision);
  if (!res.ok) { showToast(t(res.error), 'error'); return; }
  showToast(`${recordId} — ${t(decision)}`, decision === 'v.aprovado' ? 'success' : 'warning');
  const containerMap = { finance: 'opsFinanceContent', operations: 'opsOperationsContent', hr_services: 'opsHrContent' };
  await renderOpsSection(sectionKey, containerMap[sectionKey], AppState.currentRole);
}

async function reviewOpsEntry(entryId, decision, sectionKey) {
  const res = await MockAPI.reviewOpsSubmission(AppState.accessToken, entryId, decision);
  if (!res.ok) { showToast(t(res.error), 'error'); return; }
  showToast(`${entryId} — ${t(decision === 'approved' ? 'status.approved' : 'status.flagged')}`,
    decision === 'approved' ? 'success' : 'warning');
  const containerMap = { operations: 'opsOperationsContent', hr_services: 'opsHrContent' };
  await renderOpsSection(sectionKey, containerMap[sectionKey], AppState.currentRole);
}

/* --- Visão Geral (admin_manager only — cross-unit summary, §3.1) --- */
async function renderOpsOverview() {
  const kpiEl = document.getElementById('opsOverviewKpis');
  const tbody = document.getElementById('opsOverviewTableBody');
  if (!kpiEl || !tbody) return;

  const subRes = await MockAPI.listOpsSubmissions(AppState.accessToken);
  const entries = subRes.ok ? subRes.data : [];
  const pending = entries.filter(e => e.reviewStatus === 'pending_review');

  const perUnit = ['finance', 'operations', 'hr_services'].map(unit => {
    const unitEntries = entries.filter(e => e.unit === unit);
    const open = Object.entries(ADMIN_OPS_ENTITY_REGISTRY)
      .filter(([, m]) => m.unit === unit)
      .reduce((sum, [entity]) => sum + (MECUZI_DATA[unitCollectionName(entity)] || []).length, 0);
    const alerts = unit === 'operations' ? 2 : (unit === 'finance' ? 1 : 1);
    return { unit, pending: unitEntries.filter(e => e.reviewStatus === 'pending_review').length, open, alerts };
  });

  kpiEl.innerHTML = `
    <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('ops.kpi_units')}</span>
      <span class="badge badge-success">3</span></div><div class="stat-value">3 / 3</div>
      <div class="stat-trend trend-good">${t('ops.kpi_units_sub')}</div></div>
    <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('ops.kpi_pending')}</span>
      <span class="badge badge-warning">${pending.length}</span></div><div class="stat-value">${pending.length}</div>
      <div class="stat-trend trend-warning">${t('ops.kpi_pending_sub')}</div></div>
    <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('ops.kpi_budget')}</span>
      <span class="badge badge-warning">${t('ops.kpi_day20')}</span></div><div class="stat-value">${t('ops.kpi_day20')}</div>
      <div class="stat-trend trend-warning">${t('ops.kpi_budget_sub')}</div></div>
    <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('ops.kpi_staff')}</span>
      <span class="badge badge-neutral">8</span></div><div class="stat-value">8</div>
      <div class="stat-trend trend-good">${t('ops.kpi_staff_sub')}</div></div>`;

  tbody.innerHTML = perUnit.map(u => `
    <tr>
      <td><strong>${t('ops.section_' + (u.unit === 'hr_services' ? 'hr' : u.unit))}</strong></td>
      <td>${u.pending > 0 ? `<span class="badge badge-warning">${u.pending}</span>` : `<span class="badge badge-success">0</span>`}</td>
      <td>${u.open}</td>
      <td><span class="badge ${u.alerts > 0 ? 'badge-danger' : 'badge-success'}">${u.alerts}</span></td>
    </tr>`).join('');

  AppState.lastOpsOverview = perUnit; // for Excel export
}

// Export the Visão Geral cross-unit summary table
function exportOpsOverview() {
  const perUnit = AppState.lastOpsOverview || [];
  const headers = [t('ops.th_unit'), t('ops.th_pending_reviews'), t('ops.th_open_items'), t('ops.th_alerts')];
  const rows = perUnit.map(u => [
    t('ops.section_' + (u.unit === 'hr_services' ? 'hr' : u.unit)), u.pending, u.open, u.alerts
  ]);
  downloadExcel(`visao_geral_${currentLocale}.xls`, buildExcelHtml(t('ops.overview_title'), headers, rows));
  showToast(`${t('ops.btn_export_excel')} — ${t('ops.overview_title')} (.xls)`, 'success');
}

function unitCollectionName(entity) {
  // Mirror of the API's collection map, for client-side counts only
  const map = {
    budget_line: 'opsBudgetLines', payment: 'opsPayments', cost_entry: 'opsCostEntries',
    procurement_request: 'opsProcurementRequests', stock_reconciliation: 'opsStockReconciliations',
    cash_reconciliation: 'opsCashReconciliations', financial_report: 'opsFinancialReports',
    document_record: 'opsDocuments', inventory_item: 'opsInventory', field_requisition: 'opsFieldRequisitions',
    postharvest_batch: 'opsPostharvestBatches', transport_log: 'opsTransportLogs',
    warehouse_ledger_entry: 'opsWarehouseLedger', borehole_reading: 'opsBoreholeReadings',
    waste_log: 'opsWasteLogs', harvest_task: 'opsHarvestTasks', meal_log: 'opsMealLogs',
    kitchen_stock: 'opsKitchenStock', wellbeing_note: 'opsWellbeingNotes',
    hygiene_checklist: 'opsHygieneChecklists', first_aid_log: 'opsFirstAidLogs',
    maintenance_ticket: 'opsMaintenanceTickets'
  };
  return map[entity];
}

/* --- Operational Data Entry (shared shell, spec §7) --- */
function renderOpsEntryInterface(role) {
  const container = document.getElementById('opsEntryFormContent');
  if (!container) return;
  const forms = OPS_ENTRY_FORMS[role] || [];
  AppState.currentEntryFormId = forms.length ? forms[0].formId : null;

  const toggles = forms.map((f, i) =>
    `<button type="button" class="touch-type-btn ${i === 0 ? 'active' : ''}" data-form="${f.formId}"
       onclick="selectOpsEntryForm('${role}','${f.formId}', this)">${t(f.titleKey)}</button>`).join('');

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${t('entry.shell_title')}</span>
        <div style="display:flex;gap:0.4rem;align-items:center;">
          <span class="badge badge-neutral">${t('ft.badge_offline_safe')}</span>
          <!-- "Report Fire / Smoke" — 1 tap from the entry home screen (§2.4) -->
          <button type="button" class="btn btn-danger btn-sm" onclick="openFireReportModal()">${t('fire.btn_report')}</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${t('ft.lbl_activity_type')}</label>
        <div class="touch-btn-grid">${toggles}</div>
      </div>
      <form onsubmit="submitOpsEntryForm(event, '${role}')">
        <div style="display:flex;flex-direction:column;gap:0.85rem;" id="opsEntryFields"></div>
      </form>
    </div>`;

  renderOpsEntryFields(role, AppState.currentEntryFormId);
  renderOpsEntrySyncTable();
}

function selectOpsEntryForm(role, formId, btnEl) {
  document.querySelectorAll('#opsEntryFormContent .touch-type-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  AppState.currentEntryFormId = formId;
  renderOpsEntryFields(role, formId);
}

function renderOpsEntryFields(role, formId) {
  const fieldsEl = document.getElementById('opsEntryFields');
  if (!fieldsEl) return;
  const form = (OPS_ENTRY_FORMS[role] || []).find(f => f.formId === formId);
  if (!form) { fieldsEl.innerHTML = ''; return; }

  fieldsEl.innerHTML = form.fields.map(field => {
    const input = field.t === 'select'
      ? `<select class="form-control" id="opsEntryField_${field.k}">${field.options.map(o => `<option value="${o}">${t(o)}</option>`).join('')}</select>`
      : `<input type="${field.t}" ${field.t === 'number' ? 'step="0.1"' : ''} class="form-control" id="opsEntryField_${field.k}" required>`;
    return `<div class="form-group"><label class="form-label">${t(field.l)}</label>${input}</div>`;
  }).join('') + `
    <button type="submit" class="btn btn-primary" style="padding: 0.65rem 1.5rem; font-size: 13px;">
      <span>${t('ft.btn_save_device')}</span>
      <span class="btn-arrow-circle">→</span>
    </button>`;
}

async function submitOpsEntryForm(event, role) {
  event.preventDefault();
  const form = (OPS_ENTRY_FORMS[role] || []).find(f => f.formId === AppState.currentEntryFormId);
  if (!form) return;

  const data = {};
  form.fields.forEach(field => {
    const el = document.getElementById(`opsEntryField_${field.k}`);
    data[field.k] = field.t === 'number' ? parseFloat(el?.value || 0) : (el?.value || '');
  });

  const entry = {
    id: `OPS-UUID-${Math.floor(1000 + Math.random() * 9000)}`,
    formId: form.formId,
    data: data,
    submittedAt: new Date().toLocaleDateString('pt-PT') + ' ' + new Date().toLocaleTimeString().slice(0, 5),
    syncStatus: AppState.isOffline ? 'pending' : 'synced',
    reviewStatus: 'pending_review'
  };

  // The API routes the submission to the correct unit lead's queue (§7.1)
  const res = await MockAPI.submitOpsEntry(AppState.accessToken, entry);
  if (!res.ok) { showToast(t(res.error), 'error'); return; }

  showToast(`${entry.id} — ${t('ft.btn_save_device')}`, 'success');
  renderOpsEntrySyncTable();
  switchTab('entry_sync');
}

function renderOpsEntrySyncTable() {
  const tbody = document.getElementById('opsEntrySyncTableBody');
  if (!tbody) return;
  const myId = AppState.claims ? AppState.claims.sub : null;
  const myEntries = MECUZI_DATA.opsEntries.filter(e => e.submittedBy === myId);

  const entryRows = myEntries.map(e => {
    const syncBadge = e.syncStatus === 'synced'
      ? `<span class="badge badge-success">${t('status.synced')}</span>`
      : `<span class="badge badge-warning">${t('status.saved_device')}</span>`;
    const reviewBadge = e.reviewStatus === 'approved'
      ? `<span class="badge badge-success">${t('status.approved')}</span>`
      : (e.reviewStatus === 'flagged'
          ? `<span class="badge badge-danger">${t('status.flagged')}</span>`
          : `<span class="badge badge-neutral">${t('status.pending_review')}</span>`);
    return `<tr>
      <td><strong>${e.id}</strong></td>
      <td><span class="badge badge-neutral">${t('entry.form_' + e.formId)}</span></td>
      <td>${e.submittedAt}</td>
      <td>${syncBadge}</td>
      <td>${reviewBadge}</td>
    </tr>`;
  }).join('');

  // Manual fire reports filed offline appear in this same queue (§2.4)
  const fireRows = MECUZI_DATA.fireHotspots
    .filter(h => h.source === 'human_report' && h.reportedBy === myId)
    .map(h => {
      const syncBadge = h.syncStatus === 'synced'
        ? `<span class="badge badge-success">${t('status.synced')}</span>`
        : `<span class="badge badge-warning">${t('status.saved_device')}</span>`;
      return `<tr>
      <td><strong>${h.id}</strong></td>
      <td><span class="badge badge-danger">${t('fire.btn_report')}</span></td>
      <td>${h.detectedAt.slice(0, 16).replace('T', ' ')}</td>
      <td>${syncBadge}</td>
      <td><span class="badge badge-danger">${t('climate.sev_critical')}</span></td>
    </tr>`;
    }).join('');

  tbody.innerHTML = fireRows + entryRows;
}

async function syncOpsEntriesNow() {
  showToast(t('entry.btn_sync_all') + '...', 'navy');
  const res = await MockAPI.syncOpsEntries(AppState.accessToken);
  if (!res.ok) { showToast(t(res.error), 'error'); return; }
  // Queued offline fire reports sync here too — critical alert + SMS fire
  // at sync time, never on a scheduled evaluation cycle (§5, §12)
  const fireRes = await MockAPI.syncFireReports(AppState.accessToken);
  setTimeout(() => {
    renderOpsEntrySyncTable();
    showToast(t('status.synced'), 'success');
    if (fireRes.ok && fireRes.data.synced > 0) {
      showToast(t('fire.alert_raised'), 'error');
      renderClimateAlerts();
    }
  }, 900);
}

/* --- Excel export (dependency-free .xls via SpreadsheetML-in-HTML) ---
   Values are exported ALREADY TRANSLATED into the active locale. --- */
function buildExcelHtml(title, headers, rows) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head>
<body><table border="1">
<thead><tr><th colspan="${headers.length}" style="background:#0D3600;color:#fff;font-weight:bold;">${esc(title)}</th></tr>
<tr>${headers.map(h => `<th style="background:#2B7B13;color:#fff;">${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
</table></body></html>`;
}

function downloadExcel(filename, html) {
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Export one ops sub-view table (spec §4–§6) — .xls, current locale.
// Sensitive entities (wellbeing_note) get NO export button (§6.1.3, §10).
function exportOpsTable(entity) {
  const view = Object.values(OPS_SECTIONS).flat().find(v => v.entity === entity);
  if (!view) return;
  const rows = (MECUZI_DATA[unitCollectionName(entity)] || []).map(row =>
    view.cols.map(c => {
      const raw = row[c.f];
      if (c.fmt === 'mzn') return `${Number(raw).toLocaleString('pt-PT')} MZN`;
      if (c.fmt === 'pct') return `${raw}%`;
      return raw == null ? '' : trVal(raw);
    })
  );
  const headers = view.cols.map(c => t(c.h));
  downloadExcel(`${entity}_${currentLocale}.xls`, buildExcelHtml(t(view.titleKey), headers, rows));
  showToast(`${t('ops.btn_export_excel')} — ${t(view.titleKey)} (.xls)`, 'success');
}

// Export the supervision queue table
function exportOpsQueue(sectionKey) {
  const myEntries = MECUZI_DATA.opsEntries;
  const headers = [t('pm.th_id_date'), t('ops.th_submitter'), t('entry.th_form'), t('ops.th_data'), t('ft.th_review_state')];
  const rows = myEntries.map(e => [
    `${e.id} ${e.submittedAt}`, e.submittedByName, t('entry.form_' + e.formId),
    Object.entries(e.data).map(([k, v]) => `${k}: ${trVal(v)}`).join(' · '),
    t(e.reviewStatus === 'approved' ? 'status.approved' : (e.reviewStatus === 'flagged' ? 'status.flagged' : 'status.pending_review'))
  ]);
  downloadExcel(`supervisao_${sectionKey}_${currentLocale}.xls`,
    buildExcelHtml(t('ops.supervision_title'), headers, rows));
  showToast(`${t('ops.btn_export_excel')} — ${t('ops.supervision_title')} (.xls)`, 'success');
}

// Export the entry-role sync queue table
function exportOpsEntrySync() {
  const myId = AppState.claims ? AppState.claims.sub : null;
  const myEntries = MECUZI_DATA.opsEntries.filter(e => e.submittedBy === myId);
  const headers = [t('ft.th_client_uuid'), t('entry.th_form'), t('ft.th_timestamp'), t('ft.th_device_state'), t('ft.th_review_state')];
  const rows = myEntries.map(e => [
    e.id, t('entry.form_' + e.formId), e.submittedAt,
    t(e.syncStatus === 'synced' ? 'status.synced' : 'status.saved_device'),
    t(e.reviewStatus === 'approved' ? 'status.approved' : (e.reviewStatus === 'flagged' ? 'status.flagged' : 'status.pending_review'))
  ]);
  downloadExcel(`registos_${AppState.claims ? AppState.claims.role : 'ops'}_${currentLocale}.xls`,
    buildExcelHtml(t('entry.sync_title'), headers, rows));
  showToast(`${t('ops.btn_export_excel')} (.xls)`, 'success');
}

/* --- Relatórios Consolidados (admin_manager only, spec §8) --- */
async function generateOpsReport() {
  const period = document.getElementById('opsReportPeriod')?.value || 'mensal';
  const section = document.getElementById('opsReportSection')?.value || 'all';
  const from = document.getElementById('opsReportFrom')?.value || null;
  const to = document.getElementById('opsReportTo')?.value || null;

  const res = await MockAPI.generateConsolidatedReport(AppState.accessToken, {
    period, from, to,
    sections: section === 'all' ? undefined : [section]
  });
  if (!res.ok) { showToast(t(res.error), 'error'); return; }

  AppState.lastOpsReport = res.data;
  renderOpsReportResults(res.data);
  showToast(t('ops.report_generated'), 'success');
}

function renderOpsReportResults(report) {
  const container = document.getElementById('opsReportResults');
  if (!container) return;

  const PERIOD_I18N = { semanal: 'weekly', mensal: 'monthly', trimestral: 'quarterly', semestral: 'semiannual' };
  const periodLabel = t('ops.period_' + (PERIOD_I18N[report.period] || 'monthly'));

  container.innerHTML = Object.entries(report.sections).map(([unit, entities]) => {
    const rows = Object.entries(entities).map(([entity, agg]) => {
      const titleKey = (OPS_SECTIONS[unit] || []).find(v => v.entity === entity)?.titleKey;
      const label = titleKey ? t(titleKey) : entity;
      const countText = agg.anonymized
        ? `${agg.count} — ${t('ops.anonymized_badge')}`
        : agg.count;
      return `<tr><td>${label}</td><td><strong>${countText}</strong></td></tr>`;
    }).join('');
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${t('ops.section_' + (unit === 'hr_services' ? 'hr' : unit))} — ${periodLabel}</span>
          <span class="badge badge-neutral">${report.from || '…'} → ${report.to || '…'}</span>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead><tr><th>${t('ops.th_entity')}</th><th>${t('ops.th_records')}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

function exportOpsReport(fmt) {
  if (!AppState.lastOpsReport) {
    showToast(t('ops.generate_first'), 'warning');
    return;
  }
  const report = AppState.lastOpsReport;
  if (fmt === 'xlsx') {
    // Real download: consolidated report as .xls — wellbeing data is already
    // excluded by the API unless explicitly aggregated/anonymized (§6.1.3)
    const headers = [t('ops.th_unit'), t('ops.th_entity'), t('ops.th_records')];
    const rows = [];
    Object.entries(report.sections).forEach(([unit, entities]) => {
      Object.entries(entities).forEach(([entity, agg]) => {
        const titleKey = (OPS_SECTIONS[unit] || []).find(v => v.entity === entity)?.titleKey;
        rows.push([
          t('ops.section_' + (unit === 'hr_services' ? 'hr' : unit)),
          titleKey ? t(titleKey) : entity,
          agg.anonymized ? `${agg.count} — ${t('ops.anonymized_badge')}` : agg.count
        ]);
      });
    });
    downloadExcel(`relatorio_consolidado_${report.period}_${currentLocale}.xls`,
      buildExcelHtml(`${t('ops.reports_title')} (${report.from || '…'} → ${report.to || '…'})`, headers, rows));
    showToast(`${t('ops.btn_export_xlsx')} (.xls)`, 'success');
    return;
  }
  showToast(`${t('ops.btn_export_' + fmt)} (relatorio_consolidado_${report.period}.${fmt})...`, 'navy');
}

/* ==========================================================================
   Top Management exports
   ========================================================================== */
function csvCell(value) {
  return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

function exportCSVReport() {
  const headers = ['period', 'cashew_kg', 'beans_kg', 'total_kg', 'target_kg', 'attainment_pct', 'recorded_value_mzn', 'record_status'];
  const rows = MECUZI_DATA.yieldData.map(y => {
    const totalKg = y.cajuKg + y.feijaoKg;
    return [t(y.periodKey), y.cajuKg, y.feijaoKg, totalKg, y.targetKg, (totalKg / y.targetKg * 100).toFixed(2), y.totalValueMzn, 'recorded_pending_validation'];
  });
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  downloadBlob(`yield_ledger_2026_${currentLocale}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  showToast(t('tm.export_csv_success'), 'success');
}

function buildSimplePdf(lines) {
  const pageLines = [];
  lines.forEach(line => {
    const text = String(line);
    if (!text) { pageLines.push(''); return; }
    for (let i = 0; i < text.length; i += 92) pageLines.push(text.slice(i, i + 92));
  });
  const pages = [];
  for (let i = 0; i < pageLines.length; i += 36) pages.push(pageLines.slice(i, i + 36));
  if (!pages.length) pages.push([]);
  const pageObjects = [];
  const contentObjects = [];
  const objects = [
    null,
    null
  ];
  pages.forEach(page => {
    const stream = ['BT', '/F1 10 Tf', '50 760 Td', ...page.flatMap((line, index) => [
      index ? '0 -19 Td' : '',
      `(${String(line).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, ch => `\\${ch}`)}) Tj`
    ]), 'ET'].filter(Boolean).join('\n');
    contentObjects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  const fontObject = objects.length + contentObjects.length + pages.length + 1;
  contentObjects.forEach(content => objects.push(content));
  pages.forEach((page, index) => {
    const contentId = 3 + index;
    pageObjects.push(objects.length + 1);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjects.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjects.length} >>`;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = new TextEncoder().encode(pdf).length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function exportPDFReport() {
  const rows = MECUZI_DATA.yieldData;
  const totalKg = rows.reduce((sum, row) => sum + row.cajuKg + row.feijaoKg, 0);
  const targetKg = rows.reduce((sum, row) => sum + row.targetKg, 0);
  const cajuKg = rows.reduce((sum, row) => sum + row.cajuKg, 0);
  const feijaoKg = rows.reduce((sum, row) => sum + row.feijaoKg, 0);
  const recordedValue = rows.reduce((sum, row) => sum + row.totalValueMzn, 0);
  const firstTotal = rows[0].cajuKg + rows[0].feijaoKg;
  const lastTotal = rows[rows.length - 1].cajuKg + rows[rows.length - 1].feijaoKg;
  const attainment = targetKg ? (totalKg / targetKg) * 100 : 0;
  const growth = firstTotal ? ((lastTotal / firstTotal) - 1) * 100 : 0;
  const best = rows.reduce((a, b) => (a.cajuKg + a.feijaoKg) > (b.cajuKg + b.feijaoKg) ? a : b);
  const activeFields = MECUZI_DATA.fields.filter(field => field.status === 'active' || field.statusKey === 'field_status.active').length || MECUZI_DATA.fields.length;
  const areaHa = MECUZI_DATA.fields.reduce((sum, field) => sum + Number(field.areaHa || 0), 0);
  const criticalAlerts = (MECUZI_DATA.climateAlerts || []).filter(alert => alert.severity === 'critical' && !alert.resolvedAt);
  const fmt = value => Number(value).toLocaleString('en-GB');
  const money = value => `MZN ${fmt(value)}`;
  const lines = [
    'MONTHLY PRODUCTION DOSSIER',
    'Mecuzi Farm Management | Production management dossier | 2026 YTD',
    `Prepared ${new Date().toLocaleDateString('en-GB')}`,
    '',
    'EXECUTIVE CONCLUSION',
    `Recorded production reached ${(totalKg / 1000).toFixed(1)} tonnes against a ${(targetKg / 1000).toFixed(1)}-tonne target: ${attainment.toFixed(1)}% attainment and ${(totalKg - targetKg) / 1000 >= 0 ? '+' : ''}${((totalKg - targetKg) / 1000).toFixed(1)} tonnes versus plan.`,
    `Monthly output increased from ${(firstTotal / 1000).toFixed(1)} tonnes in January to ${(lastTotal / 1000).toFixed(1)} tonnes in June (${growth.toFixed(0)}% growth), with the strongest month at ${t(best.periodKey)}.`,
    `The production record supports a credible scale-up narrative, subject to commercial validation of pricing, costs, quality and sales contracts.`,
    '',
    'INVESTOR KPIs',
    `Total production: ${(totalKg / 1000).toFixed(1)} tonnes | Target: ${(targetKg / 1000).toFixed(1)} tonnes | Variance: +${((totalKg - targetKg) / 1000).toFixed(1)} tonnes`,
    `Recorded production value: ${money(recordedValue)} | Monthly average: ${money(recordedValue / rows.length)}`,
    `Production footprint: ${activeFields} active fields | ${fmt(areaHa)} hectares recorded | ${(totalKg / 1000 / (areaHa || 1)).toFixed(2)} tonnes per recorded hectare`,
    `Crop mix: cashew ${(cajuKg / totalKg * 100).toFixed(1)}% (${(cajuKg / 1000).toFixed(1)} tonnes) | beans ${(feijaoKg / totalKg * 100).toFixed(1)}% (${(feijaoKg / 1000).toFixed(1)} tonnes)`,
    '',
    'MONTHLY PRODUCTION PERFORMANCE',
    'Period                         Output       Target       Attainment       Recorded value',
    ...rows.map(row => {
      const output = row.cajuKg + row.feijaoKg;
      return `${t(row.periodKey).padEnd(28)} ${(output / 1000).toFixed(1).padStart(6)} t     ${(row.targetKg / 1000).toFixed(1).padStart(6)} t        ${(output / row.targetKg * 100).toFixed(0).padStart(5)}%        ${money(row.totalValueMzn)}`;
    }),
    '',
    'PRODUCTION INSIGHTS',
    `1. Output exceeded the cumulative target by ${((totalKg - targetKg) / 1000).toFixed(1)} tonnes, indicating production execution above plan during the reporting period.`,
    `2. Cashew contributed ${(cajuKg / 1000).toFixed(1)} tonnes and remains the principal value driver; beans provide a complementary ${((feijaoKg / totalKg) * 100).toFixed(1)}% of volume.`,
    `3. June remained ${((lastTotal / rows[rows.length - 1].targetKg) * 100 - 100).toFixed(0)}% above its monthly target despite easing from the May peak, which merits monitoring rather than being treated as a structural decline.`,
    '',
    'RISK AND MITIGATION WATCH',
    `${criticalAlerts.length} unresolved critical operational alerts are recorded in the system. Current exposure includes harvest-window heavy rain, a nearby fire detection and high-wind conditions.`,
    'Management action: protect exposed harvest and drying stock, maintain field inspection coverage, and confirm contingency logistics before the next harvest window.',
    '',
    'EVIDENCE AND SCOPE',
    'This briefing is calculated from the FARM_SYSTEM production ledger and operational alert records. “Recorded production value” is not presented as audited revenue or profit. Investor diligence should reconcile volumes, prices, costs, inventory movements and signed sales evidence.',
    `Source period: ${t(rows[0].periodKey)} to ${t(rows[rows.length - 1].periodKey)} | Generated by FARM_SYSTEM management reporting | Locale: ${currentLocale}`
  ];
  downloadBlob(`investor_production_briefing_2026_${currentLocale}.pdf`, buildSimplePdf(lines), 'application/pdf');
  showToast(t('tm.export_pdf_success'), 'success');
}

function exportCouncilBriefing() {
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const rows = MECUZI_DATA.yieldData.map(y => {
    const totalKg = y.cajuKg + y.feijaoKg;
    return `<tr><td>${esc(t(y.periodKey))}</td><td>${totalKg.toLocaleString('zh-TW')} kg</td><td>${y.targetKg.toLocaleString('zh-TW')} kg</td><td>${((totalKg / y.targetKg) * 100).toFixed(0)}%</td></tr>`;
  }).join('');
  const html = `<!doctype html><html lang="zh-TW"><head><meta charset="UTF-8"><title>理事會簡報</title><style>body{font-family:Arial,"Noto Sans TC",sans-serif;color:#17320f;margin:40px}h1{color:#0D3600}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dbe4d7;padding:10px;text-align:left}th{background:#eef5eb}</style></head><body><h1>理事會簡報</h1><p>梅庫齊農場管理系統 — 2026</p><table><thead><tr><th>期間</th><th>實際產量</th><th>目標</th><th>達成率</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  downloadBlob(`council_briefing_zh-TW_2026.html`, html, 'text/html;charset=utf-8');
  showToast(t('tm.export_council_success'), 'success');
}

/* ==========================================================================
   Copilot AI Drawer
   ========================================================================== */
function buildTraditionalChinesePdf(lines) {
  const wrapped = [];
  lines.forEach(line => {
    const text = typeof line === 'object' ? String(line.text || '') : String(line);
    const type = typeof line === 'object' ? line.type : 'normal';
    if (!text) { wrapped.push({ text: '', type }); return; }
    for (let i = 0; i < text.length; i += 42) wrapped.push({ text: text.slice(i, i + 42), type });
  });
  const pages = [];
  for (let i = 0; i < wrapped.length; i += 31) pages.push(wrapped.slice(i, i + 31));
  if (!pages.length) pages.push([]);
  const objects = [null, null];
  const contentIds = [];
  const pageIds = [];
  const utf16Hex = text => {
    let hex = 'FEFF';
    for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
    return `<${hex}>`;
  };
  pages.forEach(page => {
    const stream = page.flatMap((line, index) => {
      const y = 755 - index * 22;
      const fill = line.type === 'title' ? `q 0.05 0.21 0.12 rg 42 ${y - 7} 528 22 re f Q` : line.type === 'section' ? `q 0.84 0.93 0.84 rg 42 ${y - 7} 528 22 re f Q` : line.type === 'table' ? `q 0.93 0.96 0.91 rg 42 ${y - 7} 528 22 re f Q` : '';
      const color = line.type === 'title' ? '1 1 1 rg' : '0.08 0.18 0.12 rg';
      return [fill, 'BT', '/F1 11 Tf', `50 ${y} Td`, color, `${utf16Hex(line.text)} Tj`, 'ET'];
    }).filter(Boolean).join('\n');
    contentIds.push(objects.length + 1);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  pages.forEach((page, index) => {
    pageIds.push(objects.length + 1);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${objects.length + pages.length + 1} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`);
  });
  const type0Id = objects.length + 1;
  const cidId = type0Id + 1;
  objects.push(`<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniCNS-UTF16-H /DescendantFonts [${cidId} 0 R] >>`);
  objects.push('<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) /Supplement 0 >> >>');
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = new TextEncoder().encode(pdf).length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

function exportCouncilBriefingPdf() {
  const rows = MECUZI_DATA.yieldData;
  const totalKg = rows.reduce((sum, row) => sum + row.cajuKg + row.feijaoKg, 0);
  const targetKg = rows.reduce((sum, row) => sum + row.targetKg, 0);
  const valueMzn = rows.reduce((sum, row) => sum + row.totalValueMzn, 0);
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月'];
  const fmt = value => Number(value).toLocaleString('zh-TW');
  const lines = ['董事會簡報', '梅庫齊農場管理系統 — 2026 年生產摘要', '', '投資者重點',
    `累計實際產量：${fmt(totalKg / 1000)} 噸`, `累計生產目標：${fmt(targetKg / 1000)} 噸`,
    `目標達成率：${(totalKg / targetKg * 100).toFixed(1)}%`, `已記錄生產價值：MZN ${fmt(valueMzn)}`, '', '每月生產表現',
    '月份　　實際產量　　目標　　達成率　　已記錄價值', ...rows.map((row, index) => {
      const output = row.cajuKg + row.feijaoKg;
      return `${monthNames[index] || `期間 ${index + 1}`}　${fmt(output / 1000)} 噸　${fmt(row.targetKg / 1000)} 噸　${(output / row.targetKg * 100).toFixed(0)}%　MZN ${fmt(row.totalValueMzn)}`;
    }), '', '管理層觀察', `產量較計劃高出 ${fmt((totalKg - targetKg) / 1000)} 噸，顯示本期生產執行力高於計劃。`,
    '腰果是主要產量來源；豆類提供多元化的補充產出。', '管理層應在下一個收成窗口前確認乾燥、運輸及現場防護安排。', '', '風險與治理',
    '系統目前記錄火災、收成窗口強降雨及強風等未解決的關鍵營運警報。',
    '本簡報使用系統記錄的生產資料；已記錄生產價值不等同於經審計收入或利潤。投資者審查應核對價格、成本、庫存及銷售合約。'];
  lines[0] = { text: lines[0], type: 'title' };
  [3, 9, 18, 23].forEach(index => { lines[index] = { text: lines[index], type: 'section' }; });
  lines[10] = { text: lines[10], type: 'table' };
  downloadBlob('council_briefing_zh-TW_2026.pdf', buildTraditionalChinesePdf(lines), 'application/pdf');
  showToast(t('tm.export_council_success'), 'success');
}

function openCopilot() {
  document.getElementById('copilotOverlay')?.classList.add('open');
  document.getElementById('copilotDrawer')?.classList.add('open');
}

function closeCopilot() {
  document.getElementById('copilotOverlay')?.classList.remove('open');
  document.getElementById('copilotDrawer')?.classList.remove('open');
}

/* --- Copilot query handler — unified agent pipeline (AI_ASSISTANT_SPEC.md).
       The quick-reply chips and the free-text input both feed THIS function
       (§4): language detection → SOP hybrid retrieval → tool calls with the
       user's own session claims → grounded answer with citations → audit log. --- */
async function sendCopilotPrompt(question) {
  const container = document.getElementById('copilotMessages');
  if (!container) return;

  container.innerHTML += `
    <div class="copilot-msg user">
      <div class="msg-bubble">${question}</div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;

  const thinkingId = `copilot-thinking-${Date.now()}`;
  container.innerHTML += `
    <div class="copilot-msg assistant" id="${thinkingId}">
      <div class="msg-bubble">…</div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;

  // The agent forwards the user's own session claims on every tool call (§5, §10)
  const result = await CopilotAgent.handleQuery(AppState.accessToken, question);

  const metaBits = [];
  if (result.citations.length) metaBits.push(result.citations.map(c => `[${c}]`).join(' '));
  if (result.tools.length) {
    metaBits.push(result.tools.map(t => `${t.tool} → ${t.status}`).join(' · '));
  }
  const metaHtml = metaBits.length
    ? `<div style="font-size: 9px; color: var(--color-text-muted); margin-top: 0.35rem;">${metaBits.join(' — ')} · ${result.latencyMs}ms</div>`
    : '';

  const bubble = document.getElementById(thinkingId);
  if (bubble) {
    bubble.innerHTML = `<div class="msg-bubble">${result.reply.replace(/\n/g, '<br>')}${metaHtml}</div>`;
  }
  container.scrollTop = container.scrollHeight;
}

function handleCopilotSend() {
  const input = document.getElementById('copilotInput');
  if (!input || !input.value.trim()) return;
  sendCopilotPrompt(input.value.trim());
  input.value = '';
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'warning' ? 'toast-warning' : '')}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

/* ==========================================================================
   Climate & Fire Risk UI (WEATHER_INTEGRATION_SPEC.md §6–§10)
   Every weather/fire alert renders inside the EXISTING critical-alerts
   banner — same chips, same cards, same click-to-expand. No separate widget.
   ========================================================================== */
const CLIMATE_ACK_ROLES_UI = ['farm_technician', 'production_manager', 'administrator', 'admin_manager'];
const CLIMATE_FIELD_ALERT_ROLES_UI = ['farm_technician', 'production_manager', 'admin_manager', 'operations_support_lead'];

function climateAlertsCacheKey() {
  const sub = AppState.claims ? AppState.claims.sub : 'anon';
  return `mecuzi_climate_cache_${sub}`;
}

// Farm Technician offline resilience (§7): latest alert state is cached
// locally after every successful fetch and served when there is no signal.
async function fetchVisibleClimateAlerts() {
  if (AppState.isOffline) {
    try {
      return JSON.parse(localStorage.getItem(climateAlertsCacheKey()) || '[]');
    } catch (e) { return []; }
  }
  const res = await MockAPI.listClimateAlerts(AppState.accessToken);
  if (!res.ok) return [];
  localStorage.setItem(climateAlertsCacheKey(), JSON.stringify(res.data));
  return res.data;
}

// Backend returns alert_type + message_key + params (§10) — display text is
// resolved HERE in the active locale, never on the server.
function climateMessage(a) {
  const p = a.messageParams || {};
  return tParams(a.messageKey, {
    field: p.fieldKey, source: p.sourceKey, cycle: p.cycleKey, level: p.levelKey,
    km: p.km, gust: p.gust, mm: p.mm, days: p.days, temp: p.temp, humidity: p.humidity
  });
}

function climateFieldLabel(a) {
  if (a.fieldNameKey) return t(a.fieldNameKey);
  if (a.messageParams && a.messageParams.fieldKey) return t(a.messageParams.fieldKey);
  return '—';
}

function visibleOperationalAlertCount() {
  return [...document.querySelectorAll('.alert-ticker-chip[data-alert]')]
    .filter(c => c.style.display !== 'none').length;
}

async function renderClimateAlerts() {
  if (!AppState.claims) return;
  const role = AppState.claims.role;
  const ticker = document.getElementById('alertTickerList');
  const grid = document.getElementById('alertCardsGrid');
  const badge = document.getElementById('alertCountBadge');
  // Drop previously injected climate elements (idempotent re-render)
  document.querySelectorAll('.climate-chip, .climate-card').forEach(el => el.remove());
  if (!ticker || !grid) return;

  const badgeWord = t('alerts.badge').replace(/^\s*\d+\s*/, '');
  const baseCount = visibleOperationalAlertCount();

  // Top Management: aggregated org-wide summary ONLY (§7) — no per-field alerts
  if (role === 'top_management') {
    const res = await MockAPI.getClimateOrgSummary(AppState.accessToken);
    if (res.ok) {
      const s = res.data;
      if (s.totalActive > 0) {
        const chip = document.createElement('span');
        chip.className = 'alert-ticker-chip climate-chip climate-chip-critical';
        chip.textContent = `${t('climate.summary_title')}: ${s.bySeverity.critical} ${t('climate.sev_critical')} / ${s.totalActive}`;
        chip.addEventListener('click', () => {
          document.getElementById('topAlertBar').classList.add('open');
        });
        ticker.appendChild(chip);
      }
      if (badge) badge.textContent = `${baseCount + s.bySeverity.critical} ${badgeWord}`;
      renderClimateOrgSummary(s, 'tmClimateSummary');
    }
    return;
  }

  // Administrator receives aggregate risk counts only; threshold editing is
  // handled separately in Settings and never requires field-level exposure.
  if (role === 'administrator') {
    const res = await MockAPI.getClimateOrgSummary(AppState.accessToken);
    if (res.ok) renderClimateOrgSummary(res.data, 'admClimateSummary');
    AppState.visibleClimateAlerts = [];
    if (badge && res.ok) badge.textContent = `${baseCount + res.data.bySeverity.critical} ${badgeWord}`;
    return;
  }

  // Finance, HR, and entry roles may have other reporting workflows but do
  // not receive the global climate/fire alert feed.
  if (!CLIMATE_FIELD_ALERT_ROLES_UI.includes(role)) {
    AppState.visibleClimateAlerts = [];
    if (badge) badge.textContent = `${baseCount} ${badgeWord}`;
    return;
  }

  const alerts = await fetchVisibleClimateAlerts();
  AppState.visibleClimateAlerts = alerts;
  const rank = { critical: 0, warning: 1, watch: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

  alerts.forEach(a => {
    const chip = document.createElement('span');
    chip.className = `alert-ticker-chip climate-chip climate-chip-${a.severity}`;
    chip.textContent = `${t('climate.type_' + a.alertType)}: ${climateFieldLabel(a)}`;
    chip.addEventListener('click', () => handleClimateAlertClick(a.id));
    ticker.appendChild(chip);
    grid.insertAdjacentHTML('beforeend', buildClimateCardHtml(a, role));
  });

  if (badge) {
    badge.textContent = `${baseCount + alerts.filter(a => a.severity === 'critical').length} ${badgeWord}`;
  }
  if (role === 'farm_technician') renderFtClimateContent(alerts);
}

function buildClimateCardHtml(a, role) {
  const isCritical = a.severity === 'critical';
  const sevBadge = a.severity === 'critical' ? 'badge-danger'
    : (a.severity === 'warning' ? 'badge-warning' : 'badge-neutral');

  // Production Manager: crop-cycle context on the alert (§7)
  const cycleLine = (role === 'production_manager' && a.cropCycleStatusKey)
    ? `<div class="alert-card-text" style="color: var(--color-text-muted);">${t('pm.cycles_title')}: ${t(a.cropCycleStatusKey)}</div>`
    : '';

  // Satellite + human report of the SAME fire render as ONE linked card (§12)
  const corroLine = (a.corroboratingHotspotIds && a.corroboratingHotspotIds.length > 0)
    ? `<div class="alert-card-text" style="color: var(--color-text-muted);">${t('climate.source_corroborated')} — ${[a.relatedHotspotId].concat(a.corroboratingHotspotIds).filter(Boolean).join(' + ')}</div>`
    : '';

  const ackLine = a.acknowledgedBy
    ? `<span class="alert-card-sla">${tParams('climate.acked_by', { name: a.acknowledgedBy, time: (a.acknowledgedAt || '').slice(11, 16) })}</span>`
    : (isCritical
        ? `<span class="alert-card-sla" style="color: var(--color-danger);">${t('climate.ack_required')}</span>`
        : '<span class="alert-card-sla"></span>');
  const ackBtn = (isCritical && !a.acknowledgedBy && CLIMATE_ACK_ROLES_UI.includes(role))
    ? `<a class="alert-card-action" onclick="acknowledgeClimateAlert('${a.id}')">${t('climate.btn_acknowledge')} →</a>`
    : '';

  return `
    <div class="alert-detail-card climate-card ${isCritical ? 'border-danger' : ''}">
      <div class="alert-detail-top">
        <span class="alert-card-rule ${isCritical ? 'text-danger' : ''}">${t('climate.type_' + a.alertType)}</span>
        <span class="badge ${sevBadge}">${t('climate.sev_' + a.severity)}</span>
      </div>
      <div class="alert-card-text">${climateMessage(a)}</div>
      ${cycleLine}
      ${corroLine}
      <div class="alert-card-footer">
        ${ackLine}
        ${ackBtn}
      </div>
    </div>`;
}

function handleClimateAlertClick(alertId) {
  const a = (AppState.visibleClimateAlerts || []).find(x => x.id === alertId);
  document.getElementById('topAlertBar').classList.add('open');
  if (a) {
    showToast(climateMessage(a), a.severity === 'critical' ? 'error' : 'warning');
  }
}

async function acknowledgeClimateAlert(alertId) {
  // §9: critical alerts require acknowledged_by / acknowledged_at — same
  // accountability pattern as the rest of the system (API enforces the role)
  const res = await MockAPI.acknowledgeClimateAlert(AppState.accessToken, alertId);
  if (!res.ok) { showToast(t(res.error), 'error'); return; }
  showToast(`${alertId} — ${t('climate.btn_acknowledge')}`, 'success');
  renderClimateAlerts();
}

// Aggregate org-wide climate/fire card (§7) — counts only, no field detail.
function renderClimateOrgSummary(s, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${t('climate.summary_title')}</span>
        <span class="badge badge-neutral">${t('tm.readonly_badge')}</span>
      </div>
      <div class="grid-cards-4" style="padding-top: 0.25rem;">
        <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('climate.summary_active')}</span>
          <span class="badge badge-warning">${s.totalActive}</span></div><div class="stat-value">${s.totalActive}</div></div>
        <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('climate.summary_critical_unack')}</span>
          <span class="badge badge-danger">${s.unacknowledgedCritical}</span></div><div class="stat-value">${s.unacknowledgedCritical}</div></div>
        <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('climate.summary_fields_data')}</span>
          <span class="badge badge-neutral">${s.fieldsWithWeatherData} / ${s.totalFields}</span></div><div class="stat-value">${s.fieldsWithWeatherData} / ${s.totalFields}</div></div>
        <div class="stat-tile"><div class="stat-top"><span class="stat-label">${t('climate.summary_hotspots')}</span>
          <span class="badge badge-neutral">${s.openHotspots}</span></div><div class="stat-value">${s.openHotspots}</div></div>
      </div>
    </div>`;
}

// Farm Technician: per-field weather state on the home tab, cached for
// offline viewing (§7). A field with no data shows a graceful note (§11).
function renderFtClimateContent(alerts) {
  const el = document.getElementById('ftClimateContent');
  if (!el) return;
  const myId = AppState.claims ? AppState.claims.sub : null;
  const myFields = MECUZI_DATA.fields.filter(f => f.assignedTechId === myId);

  const cards = myFields.map(f => {
    const obs = MECUZI_DATA.weatherReadings
      .filter(r => r.fieldId === f.id && !r.isForecast)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
    const weatherLine = obs
      ? `${obs.temperatureC} °C · ${obs.humidityPct}% RH · ${obs.windSpeedKmh} km/h · ${obs.precipitationMm} mm`
      : t('climate.no_data'); // §11: graceful, never crashes
    const fieldAlerts = (alerts || []).filter(a => a.fieldId === f.id);
    const alertBadges = fieldAlerts.map(a =>
      `<span class="badge ${a.severity === 'critical' ? 'badge-danger' : (a.severity === 'warning' ? 'badge-warning' : 'badge-neutral')}">${t('climate.type_' + a.alertType)}</span>`
    ).join(' ');
    return `
      <div class="card" style="gap: 0.4rem;">
        <div class="card-header" style="padding-bottom: 0.3rem;">
          <strong style="font-size: 13px; color: var(--color-primary-dark);">${t(f.nameKey)}</strong>
          ${alertBadges || `<span class="badge badge-success">OK</span>`}
        </div>
        <div style="font-size: 12px;">${weatherLine}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${t('climate.summary_title')}</span>
        <span class="badge badge-neutral">${t(AppState.isOffline ? 'app.offline_status' : 'app.online_status')}</span>
      </div>
      <div class="grid-cards-2">${cards}</div>
    </div>`;
}

/* --- ClimateAlertThreshold editor (§5: admin-configurable, not hardcoded) ---
   Rendered in Administration → Settings and Admin Operations → Settings. --- */
async function renderClimateThresholds() {
  const containers = [document.getElementById('climateThresholdsAdm'),
    document.getElementById('climateThresholdsOps')].filter(Boolean);
  if (!containers.length || !AppState.claims) return;
  if (!['administrator', 'admin_manager'].includes(AppState.claims.role)) {
    containers.forEach(c => { c.innerHTML = ''; });
    return;
  }
  const res = await MockAPI.listClimateThresholds(AppState.accessToken);
  if (!res.ok) return;

  const rows = res.data.map(row => `
    <tr>
      <td><strong>${t('climate.type_' + row.alertType)}</strong></td>
      <td>${row.comparator}</td>
      <td><input type="text" class="form-control" style="width: 90px; padding: 0.2rem 0.4rem; font-size: 11px;" id="thr_${row.id}" value="${row.value}"></td>
      <td><small class="text-muted">${row.unit}</small></td>
      <td><small>${row.appliesTo === 'all' ? t('climate.thr_scope_all') : row.appliesTo}</small></td>
      <td><button class="btn btn-secondary btn-sm" onclick="saveClimateThreshold('${row.id}')">${t('adm.btn_save_settings')}</button></td>
    </tr>`).join('');

  // §2.2: FIRMS MAP_KEY is a one-time manual setup step — surface it here
  const firmsNotice = !MECUZI_DATA.climateConfig.firmsMapKey
    ? `<p style="font-size: 11px; color: var(--color-warning); margin-top: 0.6rem;"><strong>NASA FIRMS:</strong> ${t('climate.firms_setup_notice')}</p>`
    : '';

  const html = `
    <div class="card" style="margin-top: 0.75rem;">
      <div class="card-header">
        <span class="card-title">${t('climate.thr_title')}</span>
        <span class="badge badge-neutral">ClimateAlertThreshold</span>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead><tr>
            <th>${t('climate.thr_type')}</th><th>${t('climate.thr_comparator')}</th>
            <th>${t('climate.thr_value')}</th><th>${t('climate.thr_unit')}</th>
            <th>${t('climate.thr_scope')}</th><th>${t('pm.th_actions')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${firmsNotice}
    </div>`;
  containers.forEach(c => { c.innerHTML = html; });
}

async function saveClimateThreshold(thresholdId) {
  const input = document.getElementById(`thr_${thresholdId}`);
  if (!input) return;
  const raw = input.value.trim();
  const value = isNaN(Number(raw)) || raw === '' ? raw : Number(raw);
  const res = await MockAPI.updateClimateThreshold(AppState.accessToken, thresholdId, { value });
  if (!res.ok) { showToast(t(res.error), 'error'); return; }
  showToast(`${thresholdId} — ${t('climate.thr_saved')}`, 'success');
  // Re-evaluate alerts against the new threshold immediately
  try { await MockAPI.runWeatherSync({ batchDelayMs: 0 }); } catch (e) { /* §11 */ }
  renderClimateAlerts();
}

/* --- "Report Fire / Smoke" quick-action (§2.4) ---
   Minimal form, ≤2 taps from the technician and operational-entry home
   screens. Fully offline-capable via the client-generated-ID sync pattern. --- */
const FireReportState = { severity: 'smoke_visible', photo: null };

function openFireReportModal() {
  const sel = document.getElementById('fireFieldSelect');
  if (sel) {
    const role = AppState.claims ? AppState.claims.role : null;
    // Location: field picker pre-filled with the employee's assigned field
    // when applicable (§2.4); entry roles roam the farm, so they get all fields
    let options = MECUZI_DATA.fields;
    if (role === 'farm_technician') {
      const sub = AppState.claims.sub;
      options = MECUZI_DATA.fields.filter(f => f.assignedTechId === sub);
    }
    sel.innerHTML = options.map(f =>
      `<option value="${f.id}">${t(f.nameKey)} (${f.areaHa} ha)</option>`).join('');
  }
  FireReportState.severity = 'smoke_visible';
  FireReportState.photo = null;
  const note = document.getElementById('fireNoteInput');
  if (note) note.value = '';
  const nameEl = document.getElementById('firePhotoFileName');
  if (nameEl) nameEl.textContent = t('ft.no_photo_attached');
  document.getElementById('fireSevSmoke')?.classList.add('active');
  document.getElementById('fireSevActive')?.classList.remove('active');
  document.getElementById('fireReportModalBackdrop').classList.add('open');
}

function closeFireReportModal() {
  document.getElementById('fireReportModalBackdrop').classList.remove('open');
}

function selectFireSeverity(sev) {
  FireReportState.severity = sev;
  document.getElementById('fireSevSmoke')?.classList.toggle('active', sev === 'smoke_visible');
  document.getElementById('fireSevActive')?.classList.toggle('active', sev === 'active_fire');
}

function simulateFirePhotoCapture() {
  FireReportState.photo = 'images/cashew-leaf-thumb.png';
  const nameEl = document.getElementById('firePhotoFileName');
  if (nameEl) nameEl.textContent = t('ft.photo_attached');
  showToast(t('ft.photo_attached'), 'success');
}

async function submitFireReport() {
  const fieldId = document.getElementById('fireFieldSelect')?.value;
  if (!fieldId) { showToast(t('fire.lbl_location'), 'error'); return; }
  const payload = {
    // Client-generated UUID — idempotency key for offline retries (§2.4, BACKEND_SPEC §5)
    id: `FIRE-UUID-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    fieldId: fieldId,
    severitySeen: FireReportState.severity,
    note: document.getElementById('fireNoteInput')?.value || '',
    photoUrl: FireReportState.photo,
    offline: AppState.isOffline,
    reportedAt: new Date().toISOString()
  };
  const res = await MockAPI.reportFire(AppState.accessToken, payload);
  if (!res.ok) { showToast(t(res.error), 'error'); return; }
  closeFireReportModal();
  if (res.data.queued) {
    // Offline: queued on device — critical alert + SMS fire AT SYNC TIME (§5)
    showToast(t('fire.saved_offline'), 'warning');
  } else {
    // Online: critical alert + SMS already fired inside the API call (§5)
    showToast(t('fire.alert_raised'), 'error');
  }
  renderClimateAlerts();
  renderFtSyncStatusTable();
  renderOpsEntrySyncTable();
}

// Expose globals for inline event handlers
window.switchRole = switchRole;
window.switchTab = switchTab;
window.handleAlertClick = handleAlertClick;
window.selectReportType = selectReportType;
window.simulateCameraCapture = simulateCameraCapture;
window.handleFieldReportSubmit = handleFieldReportSubmit;
window.triggerBatchSync = triggerBatchSync;
window.approveReport = approveReport;
window.flagReport = flagReport;
window.resetEmployeePin = resetEmployeePin;
window.showProvisionEmployeeModal = showProvisionEmployeeModal;
window.filterAuditLogs = filterAuditLogs;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleAuthSubmitStep1 = handleAuthSubmitStep1;
// (stale OTP exports removed — the OTP flow was deleted when auth moved
// server-side; the leftover window.* lines threw on every page load and
// silently aborted every export below them)
window.exportCSVReport = exportCSVReport;
window.exportPDFReport = exportPDFReport;
window.exportCouncilBriefing = exportCouncilBriefing;
window.exportCouncilBriefingPdf = exportCouncilBriefingPdf;
window.openCopilot = openCopilot;
window.closeCopilot = closeCopilot;
window.sendCopilotPrompt = sendCopilotPrompt;
window.handleCopilotSend = handleCopilotSend;
window.showToast = showToast;
// Administrative Operations module
window.reviewOpsRecord = reviewOpsRecord;
window.reviewOpsEntry = reviewOpsEntry;
window.selectOpsEntryForm = selectOpsEntryForm;
window.submitOpsEntryForm = submitOpsEntryForm;
window.syncOpsEntriesNow = syncOpsEntriesNow;
window.generateOpsReport = generateOpsReport;
window.exportOpsReport = exportOpsReport;
window.exportOpsTable = exportOpsTable;
window.exportOpsQueue = exportOpsQueue;
window.exportOpsOverview = exportOpsOverview;
// Climate & Fire Risk module (WEATHER_INTEGRATION_SPEC.md)
window.renderClimateAlerts = renderClimateAlerts;
window.handleClimateAlertClick = handleClimateAlertClick;
window.acknowledgeClimateAlert = acknowledgeClimateAlert;
window.renderClimateThresholds = renderClimateThresholds;
window.saveClimateThreshold = saveClimateThreshold;
window.openFireReportModal = openFireReportModal;
window.closeFireReportModal = closeFireReportModal;
window.selectFireSeverity = selectFireSeverity;
window.simulateFirePhotoCapture = simulateFirePhotoCapture;
window.submitFireReport = submitFireReport;
window.exportOpsEntrySync = exportOpsEntrySync;
