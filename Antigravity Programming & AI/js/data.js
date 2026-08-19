/* ==========================================================================
   MECUZI FARM MANAGEMENT SYSTEM — Data Model (i18n-Keyed)
   Implementing I18N_SPEC.md §4 (Machine-Readable Keys for Complete Translation)
   ========================================================================== */

const MECUZI_DATA = {
  // 1. Employees (Identity Model: Employee Number TZ# + PIN + Role)
  employees: [
    // --- Seeded test accounts, one per role (ACCESS_CONTROL_FIX.md §3.1–3.4) ---
    // Role is set here (as an Administrator would via POST /employees) and is
    // never user-selectable anywhere in the system.
    {
      id: 'EMP-T01',
      employeeNumber: 'TZ10000001',
      name: 'Conta Teste — Gestão de Topo',
      phone: '+258 84 100 0001',
      role: 'top_management',
      roleKey: 'roles.top_management',
      pin: '1111',
      status: 'active',
      point: 'Central',
      rotation: '14/2 Cycle A',
      assignedFields: [],
      createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T02',
      employeeNumber: 'TZ12000010',
      name: 'Conta Teste — Gestor de Produção',
      phone: '+258 82 100 0010',
      role: 'production_manager',
      roleKey: 'roles.production_manager',
      pin: '1010',
      status: 'active',
      point: 'Central',
      rotation: '14/2 Cycle A',
      assignedFields: [],
      createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T03',
      employeeNumber: 'TZ10000099',
      name: 'Conta Teste — Administração',
      phone: '+258 84 100 0099',
      role: 'administrator',
      roleKey: 'roles.administrator',
      pin: '1099',
      status: 'active',
      point: 'Central',
      rotation: '14/2 Cycle A',
      assignedFields: [],
      createdAt: '01/01/2026'
    },
    // (farm_technician seed = Daniel Sitoe, TZ11244045 below — ACCESS_CONTROL_FIX.md §3.2)
    // --- Administrative Operations seeds (ADMIN_OPERATIONS_DASHBOARD_SPEC.md §2) ---
    {
      id: 'EMP-T11', employeeNumber: 'TZ13000001', name: 'Conta Teste — Gestor Administrativo',
      phone: '+258 84 300 0001', role: 'admin_manager', roleKey: 'roles.admin_manager',
      pin: '2001', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T12', employeeNumber: 'TZ13000002', name: 'Conta Teste — Finança & Conformidade',
      phone: '+258 82 300 0002', role: 'finance_compliance_lead', roleKey: 'roles.finance_compliance_lead',
      pin: '2002', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T13', employeeNumber: 'TZ13000003', name: 'Conta Teste — Apoio Operacional',
      phone: '+258 84 300 0003', role: 'operations_support_lead', roleKey: 'roles.operations_support_lead',
      pin: '2003', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T14', employeeNumber: 'TZ13000004', name: 'Conta Teste — Serviços & Instalações',
      phone: '+258 82 300 0004', role: 'hr_facility_lead', roleKey: 'roles.hr_facility_lead',
      pin: '2004', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T15', employeeNumber: 'TZ13000005', name: 'Conta Teste — Motorista',
      phone: '+258 84 300 0005', role: 'driver', roleKey: 'roles.driver',
      pin: '2005', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T16', employeeNumber: 'TZ13000006', name: 'Conta Teste — Assistente de Armazém',
      phone: '+258 82 300 0006', role: 'warehouse_assistant', roleKey: 'roles.warehouse_assistant',
      pin: '2006', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T17', employeeNumber: 'TZ13000007', name: 'Conta Teste — Cozinheiro/a',
      phone: '+258 84 300 0007', role: 'cook', roleKey: 'roles.cook',
      pin: '2007', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-T18', employeeNumber: 'TZ13000008', name: 'Conta Teste — Auxiliar de Limpeza',
      phone: '+258 82 300 0008', role: 'cleaning_assistant', roleKey: 'roles.cleaning_assistant',
      pin: '2008', status: 'active', point: 'Central', rotation: '14/2 Cycle A', assignedFields: [], createdAt: '01/01/2026'
    },
    {
      id: 'EMP-001',
      employeeNumber: 'TZ11244041',
      name: 'Dr. Alberto Mondlane',
      phone: '+258 84 123 4567',
      role: 'top_management',
      roleKey: 'roles.top_management',
      pin: '1234',
      status: 'active',
      point: 'Central',
      rotation: '14/2 Cycle A',
      assignedFields: ['FLD-01', 'FLD-02', 'FLD-03', 'FLD-04', 'FLD-05', 'FLD-06'],
      createdAt: '01/01/2026'
    },
    {
      id: 'EMP-002',
      employeeNumber: 'TZ11244042',
      name: 'Eng. Mateus Cossa',
      phone: '+258 82 234 5678',
      role: 'production_manager',
      roleKey: 'roles.production_manager',
      pin: '2345',
      status: 'active',
      point: 'Central',
      rotation: '14/2 Cycle A',
      assignedFields: ['FLD-01', 'FLD-02', 'FLD-03', 'FLD-04', 'FLD-05', 'FLD-06'],
      createdAt: '01/01/2026'
    },
    {
      id: 'EMP-003',
      employeeNumber: 'TZ11244043',
      name: 'Armando Guambe',
      phone: '+258 84 345 6789',
      role: 'production_manager',
      roleKey: 'roles.production_manager',
      pin: '3456',
      status: 'active',
      point: 'Point_B',
      rotation: '14/2 Cycle A',
      assignedFields: ['FLD-03', 'FLD-04'],
      createdAt: '15/01/2026'
    },
    {
      id: 'EMP-004',
      employeeNumber: 'TZ11244044',
      name: 'Helena Macuacua',
      phone: '+258 82 456 7890',
      role: 'administrator',
      roleKey: 'roles.administrator',
      pin: '4567',
      status: 'active',
      point: 'Point_B',
      rotation: '14/2 Cycle A',
      assignedFields: [],
      createdAt: '01/01/2026'
    },
    {
      id: 'EMP-005',
      employeeNumber: 'TZ11244045',
      name: 'Daniel Sitoe',
      phone: '+258 84 567 8901',
      role: 'farm_technician',
      roleKey: 'roles.farm_technician',
      pin: '5678',
      status: 'active',
      point: 'Point_A',
      rotation: '14/2 Cycle A',
      assignedFields: ['FLD-01', 'FLD-02'],
      createdAt: '01/02/2026'
    },
    {
      id: 'EMP-006',
      employeeNumber: 'TZ11244046',
      name: 'Luisa Banze',
      phone: '+258 82 678 9012',
      role: 'farm_technician',
      roleKey: 'roles.farm_technician',
      pin: '6789',
      status: 'active',
      point: 'Point_B',
      rotation: '14/2 Cycle A',
      assignedFields: ['FLD-03', 'FLD-04'],
      createdAt: '01/02/2026'
    },
    {
      id: 'EMP-007',
      employeeNumber: 'TZ11244047',
      name: 'Samuel Matusse',
      phone: '+258 84 789 0123',
      role: 'farm_technician',
      roleKey: 'roles.farm_technician',
      pin: '7890',
      status: 'pending',
      point: 'Point_C',
      rotation: '14/2 Cycle B',
      assignedFields: ['FLD-05', 'FLD-06'],
      createdAt: '10/08/2026'
    }
  ],

  // 2. Fields Metadata (200 ha across Point A, B, C)
  fields: [
    {
      id: 'FLD-01',
      nameKey: 'fields.fld_01_name',
      locationKey: 'fields.fld_01_loc',
      cropKey: 'crops.caju_dwarf',
      stageKey: 'stages.flowering_maturing',
      waterSourceKey: 'water.bh_01',
      coords: '(-24.184, 34.721)',
      areaHa: 35.0,
      status: 'on-track',
      treesCount: 5250,
      assignedTechId: 'TZ11244045',
      assignedTechName: 'Daniel Sitoe',
      yieldForecastKg: 14000
    },
    {
      id: 'FLD-02',
      nameKey: 'fields.fld_02_name',
      locationKey: 'fields.fld_02_loc',
      cropKey: 'crops.caju_cowpea',
      stageKey: 'stages.vegetative',
      waterSourceKey: 'water.bh_02',
      coords: '(-24.189, 34.728)',
      areaHa: 30.0,
      status: 'attention-needed',
      treesCount: 4200,
      assignedTechId: 'TZ11244045',
      assignedTechName: 'Daniel Sitoe',
      yieldForecastKg: 9500
    },
    {
      id: 'FLD-03',
      nameKey: 'fields.fld_03_name',
      locationKey: 'fields.fld_03_loc',
      cropKey: 'crops.caju_clone',
      stageKey: 'stages.fruit_ripening',
      waterSourceKey: 'water.bh_03',
      coords: '(-24.205, 34.735)',
      areaHa: 45.0,
      status: 'on-track',
      treesCount: 6750,
      assignedTechId: 'TZ11244046',
      assignedTechName: 'Luisa Banze',
      yieldForecastKg: 18500
    },
    {
      id: 'FLD-04',
      nameKey: 'fields.fld_04_name',
      locationKey: 'fields.fld_04_loc',
      cropKey: 'crops.vegetables',
      stageKey: 'stages.staggered_harvest',
      waterSourceKey: 'water.bh_03',
      coords: '(-24.212, 34.740)',
      areaHa: 20.0,
      status: 'on-track',
      treesCount: 0,
      assignedTechId: 'TZ11244046',
      assignedTechName: 'Luisa Banze',
      yieldForecastKg: 6200
    },
    {
      id: 'FLD-05',
      nameKey: 'fields.fld_05_name',
      locationKey: 'fields.fld_05_loc',
      cropKey: 'crops.caju_mixed',
      stageKey: 'stages.pruning_health',
      waterSourceKey: 'water.bh_05',
      coords: '(-24.195, 34.760)',
      areaHa: 40.0,
      status: 'on-track',
      treesCount: 5800,
      assignedTechId: 'TZ11244047',
      assignedTechName: 'Samuel Matusse',
      yieldForecastKg: 15000
    },
    {
      id: 'FLD-06',
      nameKey: 'fields.fld_06_name',
      locationKey: 'fields.fld_06_loc',
      cropKey: 'crops.green_manure',
      stageKey: 'stages.harrowing_contouring',
      waterSourceKey: 'water.bh_06',
      coords: '(-24.220, 34.770)',
      areaHa: 30.0,
      status: 'on-track',
      treesCount: 1500,
      assignedTechId: 'TZ11244047',
      assignedTechName: 'Samuel Matusse',
      yieldForecastKg: 3000
    }
  ],

  // 3. Crop Cycles
  cropCycles: [
    {
      id: 'CYCLE-2026-A1',
      fieldId: 'FLD-01',
      fieldNameKey: 'fields.fld_01_name',
      cropKey: 'crops.caju_dwarf',
      plantingDate: '15/01/2026',
      expectedHarvestDate: '20/10/2026',
      statusKey: 'cycle_status.active_maturing',
      managerId: 'TZ11244042',
      progressPercent: 78
    },
    {
      id: 'CYCLE-2026-B1',
      fieldId: 'FLD-03',
      fieldNameKey: 'fields.fld_03_name',
      cropKey: 'crops.caju_clone',
      plantingDate: '10/01/2026',
      expectedHarvestDate: '05/11/2026',
      statusKey: 'cycle_status.active_flowering',
      managerId: 'TZ11244043',
      progressPercent: 85
    },
    {
      id: 'CYCLE-2026-B2',
      fieldId: 'FLD-04',
      fieldNameKey: 'fields.fld_04_name',
      cropKey: 'crops.cowpea_maize',
      plantingDate: '01/04/2026',
      expectedHarvestDate: '30/08/2026',
      statusKey: 'cycle_status.imminent_harvest',
      managerId: 'TZ11244043',
      progressPercent: 94
    },
    {
      id: 'CYCLE-2026-C1',
      fieldId: 'FLD-05',
      fieldNameKey: 'fields.fld_05_name',
      cropKey: 'crops.caju_mixed',
      plantingDate: '20/01/2026',
      expectedHarvestDate: '15/11/2026',
      statusKey: 'cycle_status.active_sanitation',
      managerId: 'TZ11244042',
      progressPercent: 72
    }
  ],

  // 4. Field Reports
  fieldReports: [
    {
      id: 'REP-UUID-9081',
      fieldId: 'FLD-01',
      fieldNameKey: 'fields.fld_01_name',
      technicianId: 'TZ11244045',
      technicianName: 'Daniel Sitoe',
      reportType: 'harvest',
      data: {
        qtyKg: 1250,
        qualityGrade: 'grade_a',
        nutsPerKg: 175,
        moisturePercent: 8.5,
        notesKey: 'report_notes.rep_9081'
      },
      photoUrl: 'images/cashews-thumb.png',
      submittedAt: '18/08/2026 07:45',
      syncStatus: 'synced',
      reviewStatus: 'approved',
      reviewedBy: 'Eng. Mateus Cossa',
      reviewedAt: '18/08/2026 08:30',
      reviewNotesKey: 'review_notes.rep_9081'
    },
    {
      id: 'REP-UUID-9082',
      fieldId: 'FLD-02',
      fieldNameKey: 'fields.fld_02_name',
      technicianId: 'TZ11244045',
      technicianName: 'Daniel Sitoe',
      reportType: 'issue',
      data: {
        issueTypeKey: 'alerts.water_tag',
        urgencyKey: 'urgency.high_1h',
        notesKey: 'report_notes.rep_9082'
      },
      photoUrl: 'images/cashew-leaf-thumb.png',
      submittedAt: '18/08/2026 08:15',
      syncStatus: 'synced',
      reviewStatus: 'pending_review',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotesKey: ''
    },
    {
      id: 'REP-UUID-9083',
      fieldId: 'FLD-03',
      fieldNameKey: 'fields.fld_03_name',
      technicianId: 'TZ11244046',
      technicianName: 'Luisa Banze',
      reportType: 'inspection',
      data: {
        healthStatusKey: 'health.optimal',
        pestObservedKey: 'pest.none',
        notesKey: 'report_notes.rep_9083'
      },
      photoUrl: 'images/cashew-leaf-main.png',
      submittedAt: '17/08/2026 16:30',
      syncStatus: 'synced',
      reviewStatus: 'approved',
      reviewedBy: 'Armando Guambe',
      reviewedAt: '17/08/2026 17:15',
      reviewNotesKey: 'review_notes.rep_9083'
    },
    {
      id: 'REP-UUID-9084',
      fieldId: 'FLD-04',
      fieldNameKey: 'fields.fld_04_name',
      technicianId: 'TZ11244046',
      technicianName: 'Luisa Banze',
      reportType: 'planting',
      data: {
        cropPlantedKey: 'crops.cowpea_b',
        areaM2: 4500,
        seedsUsedKg: 35,
        notesKey: 'report_notes.rep_9084'
      },
      photoUrl: 'images/cashews-thumb.png',
      submittedAt: '18/08/2026 09:10',
      syncStatus: 'pending',
      reviewStatus: 'pending_review',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotesKey: ''
    }
  ],

  // 5. Yield Data
  yieldData: [
    { periodKey: 'months.jan_2026', cajuKg: 4200, feijaoKg: 1800, totalValueMzn: 378000, targetKg: 5000 },
    { periodKey: 'months.feb_2026', cajuKg: 5800, feijaoKg: 2100, totalValueMzn: 512000, targetKg: 6000 },
    { periodKey: 'months.mar_2026', cajuKg: 7900, feijaoKg: 2400, totalValueMzn: 698000, targetKg: 7500 },
    { periodKey: 'months.apr_2026', cajuKg: 9100, feijaoKg: 3000, totalValueMzn: 814000, targetKg: 8500 },
    { periodKey: 'months.may_2026', cajuKg: 11200, feijaoKg: 3200, totalValueMzn: 994000, targetKg: 10500 },
    { periodKey: 'months.jun_2026', cajuKg: 10300, feijaoKg: 2800, totalValueMzn: 910000, targetKg: 10000 }
  ],

  // 6. Audit Logs
  auditLogs: [
    {
      id: 'LOG-8821',
      actor: 'Helena Macuacua (TZ11244044)',
      role: 'administrator',
      actionKey: 'audit_actions.PIN_RESET',
      targetEntity: 'Employee',
      targetId: 'TZ11244047',
      metadataKey: 'audit_meta.pin_reset_samuel',
      timestamp: '18/08/2026 08:30:12'
    },
    {
      id: 'LOG-8820',
      actor: 'Eng. Mateus Cossa (TZ11244042)',
      role: 'production_manager',
      actionKey: 'audit_actions.REPORT_APPROVED',
      targetEntity: 'FieldReport',
      targetId: 'REP-UUID-9081',
      metadataKey: 'audit_meta.harvest_approval_fld1',
      timestamp: '18/08/2026 08:30:00'
    },
    {
      id: 'LOG-8819',
      actor: 'Daniel Sitoe (TZ11244045)',
      role: 'farm_technician',
      actionKey: 'audit_actions.BATCH_SYNC',
      targetEntity: 'SyncQueue',
      targetId: 'BATCH-004',
      metadataKey: 'audit_meta.batch_sync_3_reports',
      timestamp: '18/08/2026 08:15:44'
    },
    {
      id: 'LOG-8818',
      actor: 'Dr. Alberto Mondlane (TZ11244041)',
      role: 'top_management',
      actionKey: 'audit_actions.LOGIN_SUCCESS',
      targetEntity: 'Auth',
      targetId: 'TZ11244041',
      metadataKey: 'audit_meta.auth_sms_otp',
      timestamp: '18/08/2026 08:00:15'
    },
    {
      id: 'LOG-8817',
      actor: 'Helena Macuacua (TZ11244044)',
      role: 'administrator',
      actionKey: 'audit_actions.EMPLOYEE_PROVISIONED',
      targetEntity: 'Employee',
      targetId: 'TZ11244047',
      metadataKey: 'audit_meta.provision_pending_samuel',
      timestamp: '10/08/2026 14:22:01'
    }
  ],

  /* ==========================================================================
     7. Administrative Operations data (ADMIN_OPERATIONS_DASHBOARD_SPEC.md §4–§7)
     Field values are operational data (kept in PT); UI chrome is i18n-keyed.
     ========================================================================== */

  // --- Section: Finança & Conformidade (§4.2) — values are i18n keys (v.*/d.*) ---
  opsBudgetLines: [
    { id: 'ORC-2026-01', crop: 'd.crop_caju_a12', activity: 'v.tratos', plannedMzn: 450000, actualMzn: 412300, period: 'Q3 2026', status: 'v.em_curso' },
    { id: 'ORC-2026-02', crop: 'd.crop_hort_b02', activity: 'v.sem_fert', plannedMzn: 120000, actualMzn: 131500, period: 'Q3 2026', status: 'v.excedido' },
    { id: 'ORC-2026-03', crop: 'v.transversal', activity: 'v.combustivel', plannedMzn: 300000, actualMzn: 348600, period: 'Q3 2026', status: 'v.desvio_15' }
  ],
  opsPayments: [
    { id: 'PAG-1041', date: '15/08/2026', beneficiary: 'AgroInsumos Lda', category: 'v.fornecedor', amountMzn: 86500, status: 'v.pago' },
    { id: 'PAG-1042', date: '17/08/2026', beneficiary: 'd.ben_cfw_s33', category: 'v.trabalhadores', amountMzn: 54200, status: 'v.pendente' },
    { id: 'PAG-1043', date: '18/08/2026', beneficiary: 'Electra Serviços', category: 'v.prestador', amountMzn: 12800, status: 'v.rejeitado' }
  ],
  opsCostEntries: [
    { id: 'CST-0801', period: 'Jul/2026', crop: 'v.caju', activity: 'v.colheita', totalMzn: 198400 },
    { id: 'CST-0802', period: 'Jul/2026', crop: 'v.feijao_boer', activity: 'v.plantio', totalMzn: 64100 },
    { id: 'CST-0803', period: 'Jul/2026', crop: 'v.transversal', activity: 'v.irrigacao', totalMzn: 87750 }
  ],
  opsProcurementRequests: [
    { id: 'PRC-301', date: '16/08/2026', item: 'd.item_npk_50', quantity: 50, supplier: 'AgroInsumos Lda', amountMzn: 212500, status: 'v.pendente' },
    { id: 'PRC-302', date: '17/08/2026', item: 'd.item_fungicida', quantity: 20, supplier: 'QuimAgro', amountMzn: 38900, status: 'v.pendente' },
    { id: 'PRC-303', date: '12/08/2026', item: 'd.item_sacas', quantity: 400, supplier: 'PlastiMoz', amountMzn: 24000, status: 'v.aprovado' }
  ],
  opsStockReconciliations: [
    { id: 'RCS-081', date: '31/07/2026', item: 'd.item_npk', systemQty: 120, physicalQty: 118, variance: -2, valueMzn: -8500 },
    { id: 'RCS-082', date: '31/07/2026', item: 'd.item_castanha', systemQty: 48500, physicalQty: 48500, variance: 0, valueMzn: 0 }
  ],
  opsCashReconciliations: [
    { id: 'RCC-091', date: '15/08/2026', expectedMzn: 152300, countedMzn: 152300, variance: 0, status: 'v.conforme' },
    { id: 'RCC-092', date: '31/07/2026', expectedMzn: 98400, countedMzn: 98150, variance: -250, status: 'v.divergencia' }
  ],
  opsFinancialReports: [
    { id: 'RPF-2026-07', period: 'Jul/2026', type: 'v.mensal', generatedAt: '05/08/2026', status: 'v.submetido' },
    { id: 'RPF-2026-Q2', period: 'Q2 2026', type: 'v.trimestral', generatedAt: '10/07/2026', status: 'v.submetido' }
  ],
  opsDocuments: [
    { id: 'DOC-501', title: 'd.doc_501_title', tag: 'v.financeiro', status: 'v.submetido', updatedAt: '05/08/2026' },
    { id: 'DOC-502', title: 'd.doc_502_title', tag: 'v.pagamentos', status: 'v.pronto', updatedAt: '17/08/2026' },
    { id: 'DOC-503', title: 'd.doc_503_title', tag: 'v.doadores', status: 'v.rascunho', updatedAt: '18/08/2026' }
  ],

  // --- Section: Apoio Operacional (§5.2) — values are i18n keys (v.*/d.*/fields.*/water.*) ---
  opsInventory: [
    { id: 'INV-001', item: 'd.item_sementes_feijao', category: 'v.sementes', quantity: 240, unit: 'kg', threshold: 100, status: 'v.ok' },
    { id: 'INV-002', item: 'd.item_npk', category: 'v.fertilizante', quantity: 118, unit: 'sacos', threshold: 150, status: 'v.stock_baixo' },
    { id: 'INV-003', item: 'd.item_inseticida', category: 'v.fitofarmacos', quantity: 64, unit: 'L', threshold: 40, status: 'v.ok' },
    { id: 'INV-004', item: 'd.item_ferramentas', category: 'v.ferramentas', quantity: 22, unit: 'un', threshold: 25, status: 'v.stock_baixo' }
  ],
  opsFieldRequisitions: [
    { id: 'REQ-201', date: '18/08/2026', technician: 'Daniel Sitoe (TZ11244045)', item: 'v.fertilizante', quantity: 10, field: 'fields.fld_01_name', status: 'v.pendente' },
    { id: 'REQ-202', date: '18/08/2026', technician: 'Luisa Banze (TZ11244046)', item: 'd.item_sementes_feijao', quantity: 25, field: 'fields.fld_04_name', status: 'v.pendente' },
    { id: 'REQ-203', date: '15/08/2026', technician: 'Samuel Matusse (TZ11244047)', item: 'd.item_inseticida', quantity: 5, field: 'fields.fld_05_name', status: 'v.distribuido' }
  ],
  opsPostharvestBatches: [
    { id: 'PHB-071', batch: 'Lote Caju 071', date: '17/08/2026', crop: 'v.caju_bruto', quantityKg: 1250, stage: 'v.secagem', status: 'v.em_curso' },
    { id: 'PHB-072', batch: 'Lote Caju 072', date: '18/08/2026', crop: 'v.caju_bruto', quantityKg: 980, stage: 'v.rececao_triagem', status: 'v.em_curso' },
    { id: 'PHB-070', batch: 'Lote Caju 070', date: '14/08/2026', crop: 'v.caju_bruto', quantityKg: 1100, stage: 'v.armazenado', status: 'v.concluido' }
  ],
  opsTransportLogs: [
    { id: 'TRN-901', date: '18/08/2026', vehicle: 'Camião MZ-01', driver: 'Motorista (TZ13000005)', destination: 'v.armazem_central', km: 42, fuelL: 18 },
    { id: 'TRN-902', date: '18/08/2026', vehicle: 'Trator #1', driver: 'Motorista (TZ13000005)', destination: 'fields.fld_05_name', km: 15, fuelL: 9 }
  ],
  opsWarehouseLedger: [
    { id: 'ARM-801', date: '18/08/2026', item: 'd.item_castanha', type: 'v.entrada', quantity: 980, balance: 49480 },
    { id: 'ARM-802', date: '18/08/2026', item: 'd.item_npk', type: 'v.saida', quantity: 2, balance: 118 },
    { id: 'ARM-803', date: '17/08/2026', item: 'd.item_sementes_feijao', type: 'v.saida', quantity: 10, balance: 240 }
  ],
  opsBoreholeReadings: [
    { id: 'FR-601', date: '17/08/2026', borehole: 'water.bh_01', readingM3: 38.4, avgM3: 39.1, status: 'v.normal' },
    { id: 'FR-602', date: '17/08/2026', borehole: 'water.bh_02', readingM3: 55.2, avgM3: 40.0, status: 'v.anomalia_120' },
    { id: 'FR-603', date: '17/08/2026', borehole: 'water.bh_03', readingM3: 41.0, avgM3: 40.5, status: 'v.normal' }
  ],
  opsWasteLogs: [
    { id: 'RES-401', date: '15/08/2026', category: 'v.res_organico', quantityKg: 320, destination: 'v.composteira', status: 'v.encaminhado' },
    { id: 'RES-402', date: '15/08/2026', category: 'v.res_plasticos', quantityKg: 85, destination: 'Centro Metuchira', status: 'v.envio_mensal' }
  ],
  opsHarvestTasks: [
    { id: 'CLH-101', date: '19/08/2026', field: 'fields.fld_01_name', task: 'd.task_colheita_norte', responsible: 'Daniel Sitoe', status: 'v.agendado' },
    { id: 'CLH-102', date: '20/08/2026', field: 'fields.fld_04_name', task: 'd.task_colheita_hort', responsible: 'Luisa Banze', status: 'v.agendado' }
  ],

  // --- Section: Serviços ao Colaborador & Instalações (§6.2) — i18n keys ---
  opsMealLogs: [
    { id: 'REF-301', date: '18/08/2026', meal: 'v.almoco', servings: 41, compliance: 'v.conforme_plano', status: 'v.servido' },
    { id: 'REF-302', date: '18/08/2026', meal: 'v.pequeno_almoco', servings: 38, compliance: 'v.conforme_plano', status: 'v.servido' }
  ],
  opsKitchenStock: [
    { id: 'COZ-201', item: 'd.item_arroz', quantity: 14, unit: 'sacos', expiry: '12/2026', status: 'v.ok' },
    { id: 'COZ-202', item: 'd.item_oleo', quantity: 28, unit: 'L', expiry: '03/2027', status: 'v.ok' },
    { id: 'COZ-203', item: 'd.item_feijao_kg', quantity: 35, unit: 'kg', expiry: '09/2026', status: 'v.repor_breve' }
  ],
  // SENSITIVE (§6.1.3): restricted to hr_facility_lead + admin_manager;
  // never exported/consolidated without aggregation & anonymization.
  opsWellbeingNotes: [
    { id: 'BEM-101', date: '12/08/2026', category: 'v.saude', note: 'd.bem_101_note', followUp: 'd.bem_101_follow' },
    { id: 'BEM-102', date: '15/08/2026', category: 'v.conflito', note: 'd.bem_102_note', followUp: 'd.bem_102_follow' }
  ],
  opsHygieneChecklists: [
    { id: 'HIG-501', date: '18/08/2026', area: 'v.refeitorio', completedPct: 100, status: 'v.conforme' },
    { id: 'HIG-502', date: '18/08/2026', area: 'v.balnearios_a', completedPct: 80, status: 'v.parcial' }
  ],
  opsFirstAidLogs: [
    { id: 'PS-701', date: '10/08/2026', item: 'd.item_penso', usedQty: 4, remainingQty: 26, reportedTo: 'v.dept_saude' },
    { id: 'PS-702', date: '14/08/2026', item: 'd.item_soro', usedQty: 1, remainingQty: 9, reportedTo: 'v.dept_saude' }
  ],
  opsMaintenanceTickets: [
    { id: 'MAN-601', date: '16/08/2026', location: 'd.loc_torneira', task: 'd.task_vedante', priority: 'v.baixa', status: 'v.concluido' },
    { id: 'MAN-602', date: '18/08/2026', location: 'd.loc_fechadura', task: 'd.task_fechadura', priority: 'v.media', status: 'v.em_curso' }
  ],

  // --- Operational Data Entry queue (§7) — routed to unit leads ---
  opsEntries: [
    { id: 'OPS-ENTRY-001', unit: 'operations', formId: 'trip_log', submittedBy: 'TZ13000005', submittedByName: 'Conta Teste — Motorista', data: { destination: 'v.armazem_central', purpose: 'v.entrega_castanha', km: 42, fuelL: 18 }, submittedAt: '18/08/2026 09:40', syncStatus: 'synced', reviewStatus: 'pending_review' },
    { id: 'OPS-ENTRY-002', unit: 'operations', formId: 'daily_count', submittedBy: 'TZ13000006', submittedByName: 'Conta Teste — Assistente de Armazém', data: { item: 'd.item_npk', countedQty: 118, expectedQty: 120 }, submittedAt: '18/08/2026 08:10', syncStatus: 'synced', reviewStatus: 'pending_review' },
    { id: 'OPS-ENTRY-003', unit: 'hr_services', formId: 'meal_served', submittedBy: 'TZ13000007', submittedByName: 'Conta Teste — Cozinheiro/a', data: { meal: 'v.almoco', servings: 41 }, submittedAt: '18/08/2026 13:05', syncStatus: 'synced', reviewStatus: 'pending_review' },
    { id: 'OPS-ENTRY-004', unit: 'hr_services', formId: 'cleaning_checklist', submittedBy: 'TZ13000008', submittedByName: 'Conta Teste — Auxiliar de Limpeza', data: { area: 'v.refeitorio', completedPct: 100 }, submittedAt: '18/08/2026 07:30', syncStatus: 'pending', reviewStatus: 'pending_review' }
  ],

  /* ==========================================================================
     8. Climate & Fire Risk (WEATHER_INTEGRATION_SPEC.md §2–§3a)
     Data model exactly per §3/§3a. Values are machine-readable keys / numbers —
     display text is resolved by the frontend from message_key (§10).
     Timestamps are UTC ISO-8601 (BACKEND_SPEC.md §9); formatted at the edge.
     ========================================================================== */

  // Integration configuration (§2, §4). FIRMS needs a one-time free MAP_KEY
  // registration (§2.2) — until it is filled in, the hotspot ingestion job
  // degrades gracefully: it logs the missing key and keeps serving seeded data.
  climateConfig: {
    openMeteoBaseUrl: 'https://api.open-meteo.com/v1/forecast', // no API key (§2.1)
    firmsBaseUrl: 'https://firms.modaps.eosdis.nasa.gov/api',   // §2.2
    firmsMapKey: null,        // ONE-TIME SETUP: register a free MAP_KEY (email-based) and paste it here
    firmsBufferRadiusKm: 15,  // detection buffer around each field (§2.2: 10–20km, configurable)
    fireDedupRadiusKm: 2,     // hotspots within this radius (or attributed to the same field)
                              // = the same real fire (§12). Kept small: the whole farm spans
                              // only ~4km, so a wide radius would merge distinct fires.
    weatherSyncIntervalHours: 6, // §4 ingestion schedule
    fireSyncIntervalHours: 3,    // §4 ingestion schedule
    liveApiEnabled: false     // demo mode: ingestion jobs fall back to seeded data when APIs are unreachable (§11)
  },

  // ClimateAlertThreshold (§3) — admin-configurable, NOT hardcoded in logic (§5).
  // The evaluation engine reads these rows; Administrators/Admin Manager edit
  // them in Settings. `value` is numeric for unit-based rows, a level name for
  // fire_danger rows (unit 'danger_level').
  climateAlertThresholds: [
    { id: 'THR-GUST', alertType: 'high_wind', comparator: '>', value: 60, unit: 'km/h', appliesTo: 'all' },
    { id: 'THR-CYCLONE', alertType: 'cyclone_warning', comparator: '>', value: 90, unit: 'km/h', appliesTo: 'all' },
    { id: 'THR-RAIN-24H', alertType: 'heavy_rain', comparator: '>', value: 40, unit: 'mm/24h', appliesTo: 'all' },
    { id: 'THR-FLOOD-DAY', alertType: 'flood_risk', comparator: '>', value: 20, unit: 'mm/day', appliesTo: 'all' },
    { id: 'THR-FLOOD-DAYS', alertType: 'flood_risk', comparator: '>=', value: 3, unit: 'consecutive_days', appliesTo: 'all' },
    { id: 'THR-DROUGHT-SOIL', alertType: 'drought_risk', comparator: '<', value: 0.12, unit: 'm3/m3', appliesTo: 'all' },
    { id: 'THR-DROUGHT-DAYS', alertType: 'drought_risk', comparator: '>=', value: 10, unit: 'days_without_rain', appliesTo: 'all' },
    { id: 'THR-HEAT', alertType: 'extreme_heat', comparator: '>', value: 38, unit: '°C', appliesTo: 'all' },
    { id: 'THR-HUMIDITY', alertType: 'disease_risk_humidity', comparator: '>', value: 85, unit: '%', appliesTo: 'all' },
    { id: 'THR-FIRE-WARN', alertType: 'fire_danger', comparator: '=', value: 'high', unit: 'danger_level', appliesTo: 'all' },
    { id: 'THR-FIRE-CRIT', alertType: 'fire_danger', comparator: '=', value: 'extreme', unit: 'danger_level', appliesTo: 'all' }
  ],

  // WeatherReading (§3) — Open-Meteo per-field pulls. `isForecast` marks
  // forecast rows (48h hourly / 7-day daily) vs. observed rows (§2.1).
  // FLD-06 intentionally has NO readings — the "new field / API outage"
  // graceful-degradation case (§11).
  weatherReadings: [
    // FLD-01 — mild now, heat spike forecast tomorrow (extreme_heat → watch)
    { id: 'WR-0101', fieldId: 'FLD-01', recordedAt: '2026-08-19T06:00:00Z', temperatureC: 32.1, precipitationMm: 0, precipitationProbability: 5, windSpeedKmh: 10, windGustKmh: 18, humidityPct: 60, soilMoisture: 0.21, evapotranspiration: 4.2, source: 'open_meteo', isForecast: false },
    { id: 'WR-0102', fieldId: 'FLD-01', recordedAt: '2026-08-20T12:00:00Z', temperatureC: 39.6, precipitationMm: 0, precipitationProbability: 4, windSpeedKmh: 12, windGustKmh: 22, humidityPct: 41, soilMoisture: 0.19, evapotranspiration: 5.8, source: 'open_meteo', isForecast: true },
    // FLD-02 — prolonged dry spell, no rain forecast (drought_risk → warning)
    { id: 'WR-0201', fieldId: 'FLD-02', recordedAt: '2026-08-17T06:00:00Z', temperatureC: 33.0, precipitationMm: 0, precipitationProbability: 3, windSpeedKmh: 12, windGustKmh: 20, humidityPct: 36, soilMoisture: 0.09, evapotranspiration: 4.9, source: 'open_meteo', isForecast: false },
    { id: 'WR-0202', fieldId: 'FLD-02', recordedAt: '2026-08-19T06:00:00Z', temperatureC: 33.4, precipitationMm: 0, precipitationProbability: 2, windSpeedKmh: 12, windGustKmh: 21, humidityPct: 35, soilMoisture: 0.08, evapotranspiration: 5.0, source: 'open_meteo', isForecast: false },
    { id: 'WR-0203', fieldId: 'FLD-02', recordedAt: '2026-08-20T06:00:00Z', temperatureC: 33.8, precipitationMm: 0, precipitationProbability: 5, windSpeedKmh: 11, windGustKmh: 19, humidityPct: 34, soilMoisture: 0.08, evapotranspiration: 5.1, source: 'open_meteo', isForecast: true },
    // FLD-03 — normal conditions (satellite fire detected nearby instead)
    { id: 'WR-0301', fieldId: 'FLD-03', recordedAt: '2026-08-19T06:00:00Z', temperatureC: 30.2, precipitationMm: 1.2, precipitationProbability: 20, windSpeedKmh: 14, windGustKmh: 24, humidityPct: 58, soilMoisture: 0.22, evapotranspiration: 3.9, source: 'open_meteo', isForecast: false },
    // FLD-04 — heavy rain forecast during the imminent harvest window (§5:
    // warning escalates to critical), plus humid conditions after rain
    { id: 'WR-0401', fieldId: 'FLD-04', recordedAt: '2026-08-18T06:00:00Z', temperatureC: 27.5, precipitationMm: 6.4, precipitationProbability: 70, windSpeedKmh: 16, windGustKmh: 28, humidityPct: 88, soilMoisture: 0.31, evapotranspiration: 2.6, source: 'open_meteo', isForecast: false },
    { id: 'WR-0402', fieldId: 'FLD-04', recordedAt: '2026-08-19T06:00:00Z', temperatureC: 26.8, precipitationMm: 9.1, precipitationProbability: 80, windSpeedKmh: 18, windGustKmh: 30, humidityPct: 89, soilMoisture: 0.33, evapotranspiration: 2.4, source: 'open_meteo', isForecast: false },
    { id: 'WR-0403', fieldId: 'FLD-04', recordedAt: '2026-08-20T06:00:00Z', temperatureC: 26.1, precipitationMm: 48.0, precipitationProbability: 92, windSpeedKmh: 22, windGustKmh: 36, humidityPct: 91, soilMoisture: 0.36, evapotranspiration: 2.1, source: 'open_meteo', isForecast: true },
    // FLD-05 — hot, dry, windy (fire_danger high → warning) + gale-force gusts
    // forecast within 48h (high_wind → critical)
    { id: 'WR-0501', fieldId: 'FLD-05', recordedAt: '2026-08-19T06:00:00Z', temperatureC: 36.2, precipitationMm: 0, precipitationProbability: 2, windSpeedKmh: 28, windGustKmh: 44, humidityPct: 22, soilMoisture: 0.10, evapotranspiration: 6.3, source: 'open_meteo', isForecast: false },
    { id: 'WR-0502', fieldId: 'FLD-05', recordedAt: '2026-08-20T15:00:00Z', temperatureC: 35.0, precipitationMm: 0, precipitationProbability: 8, windSpeedKmh: 41, windGustKmh: 67, humidityPct: 25, soilMoisture: 0.09, evapotranspiration: 6.0, source: 'open_meteo', isForecast: true }
  ],

  // FireHotspot (§3 + §3a) — ONE table for satellite detections and human
  // reports, distinguished by `source`. HS-SAT-0001 and HS-HUM-0001 are the
  // SAME real fire near FLD-03 — the alert pipeline links them (§12) instead
  // of raising two unrelated alerts.
  fireHotspots: [
    {
      id: 'HS-SAT-0001', fieldId: 'FLD-03', latitude: -24.212, longitude: 34.742,
      distanceToFieldKm: 3.2, detectedAt: '2026-08-19T04:30:00Z', confidence: 'high',
      brightness: 312.4, source: 'nasa_firms', satellite: 'viirs',
      reportedBy: null, photoUrls: null, note: null, syncStatus: 'synced'
    },
    {
      id: 'HS-HUM-0001', fieldId: 'FLD-03', latitude: -24.211, longitude: 34.741,
      distanceToFieldKm: 2.9, detectedAt: '2026-08-19T05:10:00Z', confidence: 'high',
      brightness: null, source: 'human_report', satellite: null,
      reportedBy: 'TZ11244046', photoUrls: ['images/cashew-leaf-thumb.png'],
      note: 'Fumo denso a nordeste do talhão', severitySeen: 'smoke_visible', syncStatus: 'synced'
    }
  ],

  // FireDangerReading (§3) — computed locally from WeatherReading (§2.3).
  // inputs_snapshot keeps the exact weather values the score derived from.
  fireDangerReadings: [
    { id: 'FD-0201', fieldId: 'FLD-02', calculatedAt: '2026-08-19T06:05:00Z', dangerScore: 36, dangerLevel: 'moderate', daysSinceRain: 12, inputsSnapshot: { temperatureC: 33.4, humidityPct: 35, windSpeedKmh: 12 } },
    { id: 'FD-0501', fieldId: 'FLD-05', calculatedAt: '2026-08-19T06:05:00Z', dangerScore: 48, dangerLevel: 'high', daysSinceRain: 9, inputsSnapshot: { temperatureC: 36.2, humidityPct: 22, windSpeedKmh: 28 } }
  ],

  // ClimateAlert (§3) — one unified alert model for weather AND fire.
  // `messageKey` + `messageParams` (never pre-formatted text, §10);
  // `relatedHotspotId` links fire_detected alerts back to their FireHotspot
  // for traceability (§12); `corroboratingHotspotIds` links a satellite
  // detection and a human report of the same fire to ONE alert (§12).
  climateAlerts: [
    {
      id: 'CAL-0001', fieldId: 'FLD-03', alertType: 'fire_detected', severity: 'critical',
      triggeredAt: '2026-08-19T04:35:00Z', resolvedAt: null, forecastWindow: null,
      messageKey: 'climate.msg_fire_detected',
      messageParams: { km: 3.2, fieldKey: 'fields.fld_03_name', sourceKey: 'climate.source_satellite' },
      relatedHotspotId: 'HS-SAT-0001', corroboratingHotspotIds: ['HS-HUM-0001'],
      acknowledgedBy: null, acknowledgedAt: null
    },
    {
      id: 'CAL-0002', fieldId: 'FLD-04', alertType: 'heavy_rain', severity: 'critical',
      triggeredAt: '2026-08-19T06:10:00Z', resolvedAt: null, forecastWindow: '24h',
      messageKey: 'climate.msg_heavy_rain_harvest',
      messageParams: { mm: 48, fieldKey: 'fields.fld_04_name', cycleKey: 'cycle_status.imminent_harvest' },
      relatedHotspotId: null, corroboratingHotspotIds: [],
      acknowledgedBy: null, acknowledgedAt: null
    },
    {
      id: 'CAL-0003', fieldId: 'FLD-05', alertType: 'high_wind', severity: 'critical',
      triggeredAt: '2026-08-19T06:10:00Z', resolvedAt: null, forecastWindow: '48h',
      messageKey: 'climate.msg_high_wind',
      messageParams: { gust: 67, fieldKey: 'fields.fld_05_name' },
      relatedHotspotId: null, corroboratingHotspotIds: [],
      acknowledgedBy: null, acknowledgedAt: null
    },
    {
      id: 'CAL-0004', fieldId: 'FLD-05', alertType: 'fire_danger', severity: 'warning',
      triggeredAt: '2026-08-19T06:10:00Z', resolvedAt: null, forecastWindow: null,
      messageKey: 'climate.msg_fire_danger',
      messageParams: { levelKey: 'climate.level_high', days: 9, fieldKey: 'fields.fld_05_name' },
      relatedHotspotId: null, corroboratingHotspotIds: [],
      acknowledgedBy: null, acknowledgedAt: null
    },
    {
      id: 'CAL-0005', fieldId: 'FLD-02', alertType: 'drought_risk', severity: 'warning',
      triggeredAt: '2026-08-19T06:10:00Z', resolvedAt: null, forecastWindow: '7d',
      messageKey: 'climate.msg_drought',
      messageParams: { days: 12, fieldKey: 'fields.fld_02_name' },
      relatedHotspotId: null, corroboratingHotspotIds: [],
      acknowledgedBy: null, acknowledgedAt: null
    },
    {
      id: 'CAL-0006', fieldId: 'FLD-01', alertType: 'extreme_heat', severity: 'watch',
      triggeredAt: '2026-08-19T06:10:00Z', resolvedAt: null, forecastWindow: '48h',
      messageKey: 'climate.msg_extreme_heat',
      messageParams: { temp: 39.6, fieldKey: 'fields.fld_01_name' },
      relatedHotspotId: null, corroboratingHotspotIds: [],
      acknowledgedBy: null, acknowledgedAt: null
    },
    {
      id: 'CAL-0007', fieldId: 'FLD-04', alertType: 'disease_risk_humidity', severity: 'watch',
      triggeredAt: '2026-08-19T06:10:00Z', resolvedAt: null, forecastWindow: '48h',
      messageKey: 'climate.msg_disease_risk',
      messageParams: { humidity: 89, fieldKey: 'fields.fld_04_name' },
      relatedHotspotId: null, corroboratingHotspotIds: [],
      acknowledgedBy: null, acknowledgedAt: null
    }
  ],

  // Mock Twilio outbox (§8) — every SMS the system "sends" lands here AND in
  // AuditLog. Critical severity only; watch/warning never fire an SMS.
  smsOutbox: []
};
