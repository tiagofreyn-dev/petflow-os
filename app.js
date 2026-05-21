/**
 * PetFlow OS - Core Application Logic
 * Integrates direct dynamic Supabase sync (custom PostgreSQL 'petflow' schema)
 * with robust client-side fallback, real-time SVG calculations, and CRM reminders simulator.
 */

// --- DYNAMIC HYBRID DATABASE MANAGER (LOCAL STORAGE + SUPABASE SCHEMA) ---
class Database {
  constructor() {
    this.isSupabaseActive = false;
    this.supabaseClient = null;
    this.init();
  }

  init() {
    // Load Supabase credentials if present
    this.supabaseUrl = localStorage.getItem('petflow_supabase_url') || '';
    this.supabaseAnonKey = localStorage.getItem('petflow_supabase_anon_key') || '';

    // Initialize local lists first
    this.customers = [];
    this.pets = [];
    this.logs = [];
    
    // Default automation settings
    this.settings = {
      triggers: {
        banho: { enabled: true, days: 7 },
        vacina: { enabled: true, months: 3 },
        sumido: { enabled: true, days: 45 }
      },
      templates: {
        banho: "Oi *{{dono_nome}}*, o *{{pet_nome}}* está completando {{dias}} dias desde o último banho! 🛁 Vamos agendar o dele para esta semana? Clique para reservar: {{link_agenda}}",
        vacina: "Olá *{{dono_nome}}*, passamos para lembrar que já faz {{dias}} dias da última aplicação de vacina/antipulgas do *{{pet_nome}}*! 💉 Vamos manter ele protegido? Reserve aqui: {{link_agenda}}",
        sumido: "Oi *{{dono_nome}}*! Sentimos a falta do *{{pet_nome}}* por aqui... Já faz {{dias}} dias que ele não nos visita! 🥺 Preparamos um cupom especial de *15% OFF* de desconto no banho e tosa para ele retornar. Vamos agendar? {{link_agenda}}"
      },
      whatsappConnected: true
    };

    // If local DB is completely unseeded, write mock data to localStorage
    if (!localStorage.getItem('petflow_customers')) {
      this.seedLocalMockData();
    }

    // Try connecting to Supabase if config is present
    if (this.supabaseUrl && this.supabaseAnonKey) {
      this.initSupabaseClient(this.supabaseUrl, this.supabaseAnonKey);
    } else {
      this.loadLocalDataOnly();
    }
  }

  seedLocalMockData() {
    const initialCustomers = [
      { id: 'c-1', name: 'Tiago de Souza', whatsapp: '(11) 98765-4321', address: 'Rua das Palmeiras, 452 - Ap 42' },
      { id: 'c-2', name: 'Ana Maria Braga', whatsapp: '(21) 99888-7766', address: 'Av. Atlântica, 1024 - Copacabana' },
      { id: 'c-3', name: 'Bruno Alves Ramos', whatsapp: '(19) 98111-2233', address: 'Rua Benjamin Constant, 95' },
      { id: 'c-4', name: 'Juliana Costa Lima', whatsapp: '(11) 97555-4433', address: 'Al. Lorena, 1500 - Cerqueira César' },
      { id: 'c-5', name: 'Carlos Eduardo Santos', whatsapp: '(31) 99222-8888', address: 'Rua da Bahia, 2020 - Savassi' },
      { id: 'c-6', name: 'Amanda Silva Prado', whatsapp: '(11) 96111-0099', address: 'Rua Augusta, 400 - Consolação' },
      { id: 'c-7', name: 'Ricardo Santos Filho', whatsapp: '(81) 98877-6655', address: 'Av. Boa Viagem, 300' }
    ];

    const initialPets = [
      { id: 'p-1', customer_id: 'c-1', name: 'Floquinho', breed: 'Shih Tzu', size: 'Pequeno', coat_type: 'Longa Lisa', frequency_days: 7, last_service_date: this.getDateOffset(-5), status: 'active' },
      { id: 'p-2', customer_id: 'c-2', name: 'Mel', breed: 'Golden Retriever', size: 'Grande', coat_type: 'Média', frequency_days: 15, last_service_date: this.getDateOffset(-13), status: 'alert' },
      { id: 'p-3', customer_id: 'c-3', name: 'Thor', breed: 'Poodle Toy', size: 'Mini', coat_type: 'Longa Ondulada', frequency_days: 7, last_service_date: this.getDateOffset(-10), status: 'alert' },
      { id: 'p-4', customer_id: 'c-4', name: 'Cacau', breed: 'Cocker Spaniel', size: 'Médio', coat_type: 'Média', frequency_days: 30, last_service_date: this.getDateOffset(-49), status: 'inactive' },
      { id: 'p-5', customer_id: 'c-5', name: 'Pipoca', breed: 'Pug', size: 'Pequeno', coat_type: 'Curta', frequency_days: 15, last_service_date: this.getDateOffset(-3), status: 'active' },
      { id: 'p-6', customer_id: 'c-6', name: 'Billy', breed: 'Yorkshire', size: 'Mini', coat_type: 'Longa Lisa', frequency_days: 7, last_service_date: this.getDateOffset(-22), status: 'inactive' },
      { id: 'p-7', customer_id: 'c-7', name: 'Pandora', breed: 'Border Collie', size: 'Médio', coat_type: 'Média', frequency_days: 30, last_service_date: this.getDateOffset(-25), status: 'active' }
    ];

    const initialLogs = [
      { id: 'l-1', pet_id: 'p-1', message_type: 'banho', sent_at: this.getDateTimeOffset(-5, 9, 30), status: 'Respondido' },
      { id: 'l-2', pet_id: 'p-2', message_type: 'banho', sent_at: this.getDateTimeOffset(-13, 10, 15), status: 'Respondido' },
      { id: 'l-3', pet_id: 'p-3', message_type: 'banho', sent_at: this.getDateTimeOffset(-10, 14, 0), status: 'Enviado' },
      { id: 'l-4', pet_id: 'p-4', message_type: 'sumido', sent_at: this.getDateTimeOffset(-4, 11, 0), status: 'Enviado' },
      { id: 'l-5', pet_id: 'p-5', message_type: 'banho', sent_at: this.getDateTimeOffset(-3, 15, 45), status: 'Respondido' },
      { id: 'l-6', pet_id: 'p-6', message_type: 'sumido', sent_at: this.getDateTimeOffset(-15, 10, 0), status: 'Enviado' },
      { id: 'l-7', pet_id: 'p-7', message_type: 'vacina', sent_at: this.getDateTimeOffset(-25, 16, 20), status: 'Respondido' }
    ];

    localStorage.setItem('petflow_customers', JSON.stringify(initialCustomers));
    localStorage.setItem('petflow_pets', JSON.stringify(initialPets));
    localStorage.setItem('petflow_logs', JSON.stringify(initialLogs));
    localStorage.setItem('petflow_settings', JSON.stringify(this.settings));
  }

  loadLocalDataOnly() {
    this.customers = JSON.parse(localStorage.getItem('petflow_customers')) || [];
    this.pets = JSON.parse(localStorage.getItem('petflow_pets')) || [];
    this.logs = JSON.parse(localStorage.getItem('petflow_logs')) || [];
    this.settings = JSON.parse(localStorage.getItem('petflow_settings')) || this.settings;
    this.isSupabaseActive = false;
  }

  saveLocalDataOnly() {
    localStorage.setItem('petflow_customers', JSON.stringify(this.customers));
    localStorage.setItem('petflow_pets', JSON.stringify(this.pets));
    localStorage.setItem('petflow_logs', JSON.stringify(this.logs));
    localStorage.setItem('petflow_settings', JSON.stringify(this.settings));
  }

  // Initialize the Supabase Client v2 mapping onto the custom 'petflow' schema
  initSupabaseClient(url, key) {
    try {
      if (typeof supabase === 'undefined') {
        throw new Error("Supabase JS Library is not loaded from CDN.");
      }
      this.supabaseClient = supabase.createClient(url, key, {
        db: { schema: 'petflow' }
      });
      this.isSupabaseActive = true;
      this.supabaseUrl = url;
      this.supabaseAnonKey = key;
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
      this.isSupabaseActive = false;
      this.loadLocalDataOnly();
    }
  }

  // Dynamic test to connect and fetch data
  async connectToSupabase(url, key) {
    try {
      if (typeof supabase === 'undefined') {
        throw new Error("SDK do Supabase não foi carregado.");
      }
      
      const testClient = supabase.createClient(url, key, {
        db: { schema: 'petflow' }
      });

      // Try running a select check on customers
      const { data, error } = await testClient.from('customers').select('id').limit(1);
      
      if (error) throw error;

      // Connection succeeded! Save credentials
      localStorage.setItem('petflow_supabase_url', url);
      localStorage.setItem('petflow_supabase_anon_key', key);
      
      this.supabaseUrl = url;
      this.supabaseAnonKey = key;
      this.supabaseClient = testClient;
      this.isSupabaseActive = true;

      // Pull cloud database tables
      await this.fetchRemoteData();
      return { success: true };
    } catch (err) {
      console.error("Supabase Connection Error:", err);
      return { success: false, error: err.message || "Erro de conexão desconhecido" };
    }
  }

  disconnectSupabase() {
    localStorage.removeItem('petflow_supabase_url');
    localStorage.removeItem('petflow_supabase_anon_key');
    this.supabaseUrl = '';
    this.supabaseAnonKey = '';
    this.supabaseClient = null;
    this.isSupabaseActive = false;
    
    // Fallback to local
    this.seedLocalMockData();
    this.loadLocalDataOnly();
  }

  async fetchRemoteData() {
    if (!this.isSupabaseActive) return false;
    try {
      const [custRes, petsRes, logsRes] = await Promise.all([
        this.supabaseClient.from('customers').select('*'),
        this.supabaseClient.from('pets').select('*'),
        this.supabaseClient.from('automations_logs').select('*')
      ]);

      if (custRes.error) throw custRes.error;
      if (petsRes.error) throw petsRes.error;
      if (logsRes.error) throw logsRes.error;

      this.customers = custRes.data || [];
      this.pets = petsRes.data || [];
      this.logs = logsRes.data || [];

      // Save locally as offline cache
      this.saveLocalDataOnly();
      return true;
    } catch (e) {
      console.error("Erro ao carregar dados do Supabase:", e);
      // fallback to local cache
      this.loadLocalDataOnly();
      return false;
    }
  }

  // --- CRUD WRAPPERS ---
  async addCustomerAndPet(customerData, petData) {
    if (this.isSupabaseActive) {
      try {
        // 1. Insert customer into Supabase schema petflow
        const custRes = await this.supabaseClient.from('customers').insert({
          name: customerData.name,
          whatsapp: customerData.whatsapp,
          address: customerData.address || ''
        }).select();
        
        if (custRes.error) throw custRes.error;
        const newCust = custRes.data[0];

        // Calculate initial status
        const calculatedStatus = this.calculatePetStatus(petData.last_service_date, parseInt(petData.frequency_days));

        // 2. Insert pet referencing the generated customer ID
        const petRes = await this.supabaseClient.from('pets').insert({
          customer_id: newCust.id,
          name: petData.name,
          breed: petData.breed,
          size: petData.size,
          coat_type: petData.coat_type,
          frequency_days: parseInt(petData.frequency_days),
          last_service_date: petData.last_service_date,
          status: calculatedStatus
        }).select();

        if (petRes.error) throw petRes.error;
        const newPet = petRes.data[0];

        // 3. Add initial log
        await this.supabaseClient.from('automations_logs').insert({
          pet_id: newPet.id,
          message_type: 'cadastro',
          status: 'Respondido'
        });

        // Sync local cache
        await this.fetchRemoteData();
        return { customer: newCust, pet: newPet };
      } catch (err) {
        console.error("Erro ao cadastrar no Supabase:", err);
        throw err;
      }
    } else {
      // Local localStorage operation
      const customerId = 'c-' + Date.now();
      const petId = 'p-' + Date.now();

      const newCustomer = {
        id: customerId,
        name: customerData.name,
        whatsapp: customerData.whatsapp,
        address: customerData.address || ''
      };

      const calculatedStatus = this.calculatePetStatus(petData.last_service_date, parseInt(petData.frequency_days));

      const newPet = {
        id: petId,
        customer_id: customerId,
        name: petData.name,
        breed: petData.breed,
        size: petData.size,
        coat_type: petData.coat_type,
        frequency_days: parseInt(petData.frequency_days),
        last_service_date: petData.last_service_date,
        status: calculatedStatus
      };

      this.customers.push(newCustomer);
      this.pets.push(newPet);
      this.logs.push({
        id: 'l-' + Date.now(),
        pet_id: petId,
        message_type: 'cadastro',
        sent_at: new Date().toISOString(),
        status: 'Respondido'
      });

      this.saveLocalDataOnly();
      return { customer: newCustomer, pet: newPet };
    }
  }

  async recordService(petId) {
    const todayStr = new Date().toISOString().split('T')[0];

    if (this.isSupabaseActive) {
      try {
        // Reset service date and status
        const petUpdate = await this.supabaseClient.from('pets').update({
          last_service_date: todayStr,
          status: 'active'
        }).eq('id', petId);

        if (petUpdate.error) throw petUpdate.error;

        // Insert done log
        const logRes = await this.supabaseClient.from('automations_logs').insert({
          pet_id: petId,
          message_type: 'banho_concluido',
          status: 'Respondido'
        });

        if (logRes.error) throw logRes.error;

        await this.fetchRemoteData();
        return true;
      } catch (err) {
        console.error("Erro ao registrar banho no Supabase:", err);
        return false;
      }
    } else {
      // Local
      const pet = this.pets.find(p => p.id === petId);
      if (pet) {
        pet.last_service_date = todayStr;
        pet.status = 'active';

        this.logs.push({
          id: 'l-' + Date.now(),
          pet_id: petId,
          message_type: 'banho_concluido',
          sent_at: new Date().toISOString(),
          status: 'Respondido'
        });

        this.saveLocalDataOnly();
        return true;
      }
      return false;
    }
  }

  async sendWhatsAppReminder(petId, type) {
    if (this.isSupabaseActive) {
      try {
        const logRes = await this.supabaseClient.from('automations_logs').insert({
          pet_id: petId,
          message_type: type,
          status: 'Enviado'
        }).select();

        if (logRes.error) throw logRes.error;
        
        await this.fetchRemoteData();
        return logRes.data[0];
      } catch (err) {
        console.error("Erro ao inserir log de automação no Supabase:", err);
        return null;
      }
    } else {
      // Local
      const newLog = {
        id: 'l-' + Date.now(),
        pet_id: petId,
        message_type: type,
        sent_at: new Date().toISOString(),
        status: 'Enviado'
      };

      this.logs.push(newLog);
      this.saveLocalDataOnly();
      return newLog;
    }
  }

  async updateLogStatus(logId, status) {
    if (this.isSupabaseActive) {
      try {
        const logRes = await this.supabaseClient.from('automations_logs').update({
          status: status
        }).eq('id', logId);

        if (logRes.error) throw logRes.error;

        await this.fetchRemoteData();
        return true;
      } catch (err) {
        console.error("Erro ao atualizar status do log no Supabase:", err);
        return false;
      }
    } else {
      // Local
      const log = this.logs.find(l => l.id === logId);
      if (log) {
        log.status = status;
        this.saveLocalDataOnly();
        return true;
      }
      return false;
    }
  }

  async deletePet(petId) {
    if (this.isSupabaseActive) {
      try {
        const pet = this.pets.find(p => p.id === petId);
        if (pet) {
          // Cascade deleting pet in Supabase (logs will delete automatically due to CASCADE in DB schema)
          const petDel = await this.supabaseClient.from('pets').delete().eq('id', petId);
          if (petDel.error) throw petDel.error;

          // Delete corresponding tutor/customer
          await this.supabaseClient.from('customers').delete().eq('id', pet.customer_id);

          await this.fetchRemoteData();
          return true;
        }
        return false;
      } catch (err) {
        console.error("Erro ao deletar no Supabase:", err);
        return false;
      }
    } else {
      // Local
      const petIndex = this.pets.findIndex(p => p.id === petId);
      if (petIndex > -1) {
        const pet = this.pets[petIndex];
        this.pets.splice(petIndex, 1);

        const customerIndex = this.customers.findIndex(c => c.id === pet.customer_id);
        if (customerIndex > -1) {
          this.customers.splice(customerIndex, 1);
        }

        this.logs = this.logs.filter(l => l.pet_id !== petId);
        this.saveLocalDataOnly();
        return true;
      }
      return false;
    }
  }

  // --- CALCULATION UTILS ---
  calculatePetStatus(lastServiceDate, frequencyDays) {
    const today = new Date();
    const lastDate = new Date(lastServiceDate);
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= this.settings.triggers.sumido.days) {
      return 'inactive'; // sumido
    } else if (diffDays >= frequencyDays) {
      return 'alert'; // alerta de retorno
    } else {
      return 'active'; // em dia
    }
  }

  recalculateAllPetStatuses() {
    this.pets.forEach(pet => {
      pet.status = this.calculatePetStatus(pet.last_service_date, pet.frequency_days);
    });
    this.saveLocalDataOnly();
  }

  // Relative offsets for seeding
  getDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  getDateTimeOffset(days, hours, minutes) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  }
}

// --- STATE AND UI CONTROLLER ---
const App = {
  db: null,
  activeView: 'dashboard',
  selectedPetId: null,
  activeTemplateTab: 'banho',

  async init() {
    this.db = new Database();
    
    // Cache Elements
    this.cacheElements();
    // Bind Event Listeners
    this.bindEvents();
    // Pre-fill Supabase settings inputs if they exist
    this.fillSettingsForm();
    
    // Fetch Remote database data first if Supabase is active
    if (this.db.isSupabaseActive) {
      await this.db.fetchRemoteData();
    }
    
    // Recalculate status ranges based on current date
    this.db.recalculateAllPetStatuses();

    // Trigger visual Skeleton Loading (800ms fade sequence)
    this.simulateLoading();
    
    // Update active view and layout
    this.render();
  },

  cacheElements() {
    this.navItems = document.querySelectorAll('.nav-item');
    this.viewPanels = document.querySelectorAll('.view-panel');
    
    this.pageTitle = document.getElementById('pageTitle');
    this.pageSubtitle = document.getElementById('pageSubtitle');
    this.skeletonScreen = document.getElementById('skeletonScreen');

    // Dashboard KPIs
    this.kpiTotalPets = document.getElementById('kpiTotalPets');
    this.kpiLostPets = document.getElementById('kpiLostPets');
    this.kpiTodaySchedules = document.getElementById('kpiTodaySchedules');
    this.kpiRecoveredIncome = document.getElementById('kpiRecoveredIncome');

    // Dashboard Alerts & Charts
    this.dashboardAlertsList = document.getElementById('dashboardAlertsList');
    this.chartTotalPetsCenter = document.getElementById('chartTotalPetsCenter');
    this.legendSemanais = document.getElementById('legendSemanais');
    this.legendQuinzenais = document.getElementById('legendQuinzenais');
    this.legendMensais = document.getElementById('legendMensais');
    this.legendInativos = document.getElementById('legendInativos');

    // Chart Circles
    this.circleSemanal = document.getElementById('chartCircleSemanal');
    this.circleQuinzenal = document.getElementById('chartCircleQuinzenal');
    this.circleMensal = document.getElementById('chartCircleMensal');
    this.circleInativo = document.getElementById('chartCircleInativo');

    // Automations Elements
    this.toggleTriggerBanho = document.getElementById('toggleTriggerBanho');
    this.toggleTriggerVacina = document.getElementById('toggleTriggerVacina');
    this.toggleTriggerSumido = document.getElementById('toggleTriggerSumido');
    this.inputDaysBanho = document.getElementById('inputDaysBanho');
    this.inputMonthsVacina = document.getElementById('inputMonthsVacina');
    this.inputDaysSumido = document.getElementById('inputDaysSumido');
    
    this.templateTextarea = document.getElementById('templateTextarea');
    this.btnTabTemplateBanho = document.getElementById('btnTabTemplateBanho');
    this.btnTabTemplateVacina = document.getElementById('btnTabTemplateVacina');
    this.btnTabTemplateSumido = document.getElementById('btnTabTemplateSumido');
    
    this.phoneMockupAvatar = document.getElementById('phoneMockupAvatar');
    this.phoneMockupTutorName = document.getElementById('phoneMockupTutorName');
    this.phoneChatPreviewBubble = document.getElementById('phoneChatPreviewBubble');
    this.phoneChatTime = document.getElementById('phoneChatTime');

    // Customer Views
    this.inputTableSearch = document.getElementById('inputTableSearch');
    this.customersTableBody = document.getElementById('customersTableBody');
    this.filterButtons = document.querySelectorAll('.filter-btn');

    // WhatsApp Settings Mocks
    this.whatsStatusBadge = document.getElementById('whatsStatusBadge');
    this.whatsStatusText = document.getElementById('whatsStatusText');
    this.whatsPulseDot = document.getElementById('whatsPulseDot');
    this.qrImage = document.getElementById('qrImage');
    this.qrOverlay = document.getElementById('qrOverlay');
    this.qrOverlayText = document.getElementById('qrOverlayText');
    this.qrStatusDot = document.getElementById('qrStatusDot');
    this.qrStatusLabel = document.getElementById('qrStatusLabel');
    this.btnToggleConnection = document.getElementById('btnToggleConnection');

    // Supabase Credentials Settings UI
    this.inputSupabaseUrl = document.getElementById('inputSupabaseUrl');
    this.inputSupabaseAnonKey = document.getElementById('inputSupabaseAnonKey');
    this.btnSaveSupabaseConfig = document.getElementById('btnSaveSupabaseConfig');
    this.supabaseStatusText = document.getElementById('supabaseStatusText');

    // Modal Add Pet
    this.addPetModalBackdrop = document.getElementById('addPetModalBackdrop');
    this.btnOpenAddPetModal = document.getElementById('btnOpenAddPetModal');
    this.btnCloseAddPetModal = document.getElementById('btnCloseAddPetModal');
    this.btnCancelAddPetModal = document.getElementById('btnCancelAddPetModal');
    this.addPetForm = document.getElementById('addPetForm');

    // Drawer Timeline Elements
    this.drawerBackdrop = document.getElementById('drawerBackdrop');
    this.drawer = document.getElementById('drawer');
    this.btnCloseDrawer = document.getElementById('btnCloseDrawer');
    this.btnDrawerRecordService = document.getElementById('btnDrawerRecordService');
    this.btnDrawerWhatsApp = document.getElementById('btnDrawerWhatsApp');
    this.drawerPetAvatar = document.getElementById('drawerPetAvatar');
    this.drawerPetName = document.getElementById('drawerPetName');
    this.drawerTutorName = document.getElementById('drawerTutorName');
    this.drawerPetBreed = document.getElementById('drawerPetBreed');
    this.drawerPetCoat = document.getElementById('drawerPetCoat');
    this.drawerPetFrequency = document.getElementById('drawerPetFrequency');
    this.drawerPetLastService = document.getElementById('drawerPetLastService');
    this.drawerTimeline = document.getElementById('drawerTimeline');

    this.toastContainer = document.getElementById('toastContainer');
  },

  bindEvents() {
    // Nav Items (SPA Switching)
    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        this.switchView(targetView);
      });
    });

    // Modal Operations
    this.btnOpenAddPetModal.addEventListener('click', () => this.toggleAddPetModal(true));
    this.btnCloseAddPetModal.addEventListener('click', () => this.toggleAddPetModal(false));
    this.btnCancelAddPetModal.addEventListener('click', () => this.toggleAddPetModal(false));
    this.addPetForm.addEventListener('submit', (e) => this.handleSubmittedPetForm(e));

    // Drawer Operations
    this.btnCloseDrawer.addEventListener('click', () => this.toggleDrawer(false));
    this.drawerBackdrop.addEventListener('click', () => this.toggleDrawer(false));
    this.btnDrawerRecordService.addEventListener('click', () => this.handleDrawerRecordService());
    this.btnDrawerWhatsApp.addEventListener('click', () => this.handleDrawerWhatsApp());

    // Automations Recurrence Settings Inputs
    this.toggleTriggerBanho.addEventListener('change', () => this.updateTriggerSettings());
    this.toggleTriggerVacina.addEventListener('change', () => this.updateTriggerSettings());
    this.toggleTriggerSumido.addEventListener('change', () => this.updateTriggerSettings());
    
    this.inputDaysBanho.addEventListener('input', () => this.updateTriggerSettings());
    this.inputMonthsVacina.addEventListener('input', () => this.updateTriggerSettings());
    this.inputDaysSumido.addEventListener('input', () => this.updateTriggerSettings());

    // Automation Template Tabs
    this.btnTabTemplateBanho.addEventListener('click', () => this.switchTemplateTab('banho'));
    this.btnTabTemplateVacina.addEventListener('click', () => this.switchTemplateTab('vacina'));
    this.btnTabTemplateSumido.addEventListener('click', () => this.switchTemplateTab('sumido'));

    this.templateTextarea.addEventListener('input', () => this.handleTemplateChange());

    // Tag Insert Buttons
    document.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-var');
        this.insertTagAtCursor(val);
      });
    });

    // Customer Table Search and Filter
    this.inputTableSearch.addEventListener('input', () => this.renderCustomersTable());
    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderCustomersTable();
      });
    });

    // WhatsApp Mock Sync
    this.btnToggleConnection.addEventListener('click', () => this.handleToggleWhatsAppConnection());
    this.qrOverlay.addEventListener('click', () => this.reconnectWhatsApp());

    // Supabase Connect Action
    this.btnSaveSupabaseConfig.addEventListener('click', () => this.handleSaveSupabaseConfig());
  },

  simulateLoading() {
    setTimeout(() => {
      if (this.skeletonScreen) {
        this.skeletonScreen.classList.add('loaded');
        this.skeletonScreen.style.display = 'none';
      }
    }, 800);
  },

  fillSettingsForm() {
    if (this.db.supabaseUrl) {
      this.inputSupabaseUrl.value = this.db.supabaseUrl;
    }
    if (this.db.supabaseAnonKey) {
      this.inputSupabaseAnonKey.value = this.db.supabaseAnonKey;
    }
    this.updateSupabaseStatusUI();
  },

  switchView(viewName) {
    this.activeView = viewName;
    
    this.navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.viewPanels.forEach(panel => {
      if (panel.id === `view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    switch (viewName) {
      case 'dashboard':
        this.pageTitle.innerText = 'Esteira Invisível';
        this.pageSubtitle.innerText = 'CRM de Acompanhamento Hiper-Focado';
        this.renderDashboard();
        break;
      case 'automations':
        this.pageTitle.innerText = 'Módulo de Automações';
        this.pageSubtitle.innerText = 'Gatilhos de Disparo e Modelos de Mensagem';
        this.renderAutomationsView();
        break;
      case 'customers':
        this.pageTitle.innerText = 'Base de Clientes & Pets';
        this.pageSubtitle.innerText = 'Cadastro, Status de Ciclo e Busca Inteligente';
        this.renderCustomersTable();
        break;
      case 'settings':
        this.pageTitle.innerText = 'Integrações Ativas';
        this.pageSubtitle.innerText = 'Sincronização com Canais de Comunicação';
        this.renderSettingsView();
        break;
    }
  },

  // --- RENDER DASHBOARD ---
  renderDashboard() {
    // 1. Calculations
    const totalPets = this.db.pets.length;
    const lostPets = this.db.pets.filter(p => p.status === 'inactive').length;
    
    // Today schedules (simulated count based on booked logs)
    const todaySchedulesCount = this.db.logs.filter(l => {
      const todayStr = new Date().toISOString().split('T')[0];
      return l.sent_at.startsWith(todayStr) && l.status === 'Respondido';
    }).length + 3; // seeded default 3 for visual richness

    // Recovered income calculations
    const recoveredLogs = this.db.logs.filter(l => l.status === 'Respondido' && (l.message_type === 'banho' || l.message_type === 'sumido')).length;
    const recoveredIncome = recoveredLogs * 85;

    // Load elements
    this.kpiTotalPets.innerText = totalPets;
    this.kpiLostPets.innerText = lostPets;
    this.kpiTodaySchedules.innerText = todaySchedulesCount;
    this.kpiRecoveredIncome.innerText = `R$ ${recoveredIncome.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

    this.renderReturnAlerts();
    this.renderDistributionChart();
  },

  renderReturnAlerts() {
    this.dashboardAlertsList.innerHTML = '';
    
    // Priority order: inactive (danger) first, then alert (warning), sorted by oldest last service date
    const sortedPets = [...this.db.pets].sort((a, b) => {
      const statusPriority = { inactive: 1, alert: 2, active: 3 };
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return new Date(a.last_service_date) - new Date(b.last_service_date);
    });

    const alertPets = sortedPets.filter(p => p.status === 'alert' || p.status === 'inactive');

    if (alertPets.length === 0) {
      this.dashboardAlertsList.innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"></path>
          </svg>
          <span style="font-weight: 700; color: #fff; display: block; margin-bottom: 4px;">Todos os Pets em Dia!</span>
          <p>Nenhum pet está no período de alerta ou sumido no momento. Excelente trabalho!</p>
        </div>
      `;
      return;
    }

    alertPets.forEach(pet => {
      const tutor = this.db.customers.find(c => c.id === pet.customer_id) || { name: 'Tutor' };
      
      const lastDate = new Date(pet.last_service_date);
      const diffTime = Math.abs(new Date() - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let alertLabel = '';
      let alertClass = '';
      let actionType = 'banho';
      
      if (pet.status === 'inactive') {
        alertLabel = 'Sumido';
        alertClass = 'danger';
        actionType = 'sumido';
      } else {
        alertLabel = `Prazo Vencido`;
        alertClass = 'warning';
        actionType = 'banho';
      }

      // Check if alert message was already sent today
      const alreadySentToday = this.db.logs.some(l => {
        const todayStr = new Date().toISOString().split('T')[0];
        return l.pet_id === pet.id && l.message_type === actionType && l.sent_at.startsWith(todayStr) && l.status === 'Enviado';
      });

      const alertItem = document.createElement('div');
      alertItem.className = `alert-item ${pet.status === 'inactive' ? 'critical' : ''}`;
      
      alertItem.innerHTML = `
        <div class="alert-left" style="cursor: pointer;" onclick="App.openPetDetail('${pet.id}')">
          <div class="pet-avatar-wrapper ${pet.status}">
            <div class="pet-avatar">${pet.name.charAt(0)}</div>
          </div>
          <div class="alert-details">
            <div class="pet-info">
              <span class="pet-name">${pet.name}</span>
              <span class="alert-badge ${alertClass}">${alertLabel}</span>
            </div>
            <span class="tutor-name">Tutor: ${tutor.name} (${pet.breed})</span>
            <div class="alert-description">
              Último banho há <span>${diffDays} dias</span> (Ciclo ideal: ${pet.frequency_days} dias)
            </div>
          </div>
        </div>
        <div>
          ${alreadySentToday 
            ? `<button class="btn-whatsapp" style="background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); color: var(--accent-purple);" onclick="App.sendMockReminder('${pet.id}', '${actionType}', this)">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"></path>
                </svg>
                Lembrete Enviado
               </button>`
            : `<button class="btn-whatsapp" onclick="App.sendMockReminder('${pet.id}', '${actionType}', this)">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.993L2 22l5.177-1.357a9.95 9.95 0 004.832 1.241h.004c5.507 0 9.991-4.479 9.992-9.986.002-2.67-1.036-5.18-2.925-7.071S14.682 2 12.012 2zm5.727 14.126c-.25.703-1.455 1.282-2.007 1.364-.477.071-.47.288-2.738-.616-2.906-1.159-4.78-4.109-4.925-4.303-.146-.195-1.173-1.558-1.173-2.975 0-1.417.744-2.112 1.007-2.393.264-.282.576-.352.768-.352.193 0 .385.002.553.01.175.008.409-.065.64.489.239.576.818 1.99.889 2.135.071.146.12.316.02.512-.1.196-.151.317-.3.489-.15.172-.315.385-.45.516-.151.146-.31.306-.133.61.177.303.788 1.299 1.688 2.099.9.8 1.657 1.047 1.958 1.169.301.122.476.103.654-.103.178-.206.768-.891.973-1.195.205-.304.41-.254.692-.15.281.103 1.787.842 2.094.996.307.153.511.23.585.358.075.128.075.742-.175 1.445z"/>
                </svg>
                Mandar Lembrete
               </button>`
          }
        </div>
      `;
      this.dashboardAlertsList.appendChild(alertItem);
    });
  },

  renderDistributionChart() {
    const total = this.db.pets.length;
    this.chartTotalPetsCenter.innerText = total;

    // Filter by frequency categories (excluding inactives)
    const semanais = this.db.pets.filter(p => p.frequency_days === 7 && p.status !== 'inactive').length;
    const quinzenais = this.db.pets.filter(p => p.frequency_days === 15 && p.status !== 'inactive').length;
    const mensais = this.db.pets.filter(p => p.frequency_days === 30 && p.status !== 'inactive').length;
    const inativos = this.db.pets.filter(p => p.status === 'inactive').length;

    this.legendSemanais.innerText = semanais;
    this.legendQuinzenais.innerText = quinzenais;
    this.legendMensais.innerText = mensais;
    this.legendInativos.innerText = inativos;

    // Donut math: radius = 40, circ = 2 * PI * 40 ≈ 251.3
    const circ = 251.3;
    
    const pctSem = total > 0 ? (semanais / total) * circ : 0;
    const pctQuin = total > 0 ? (quinzenais / total) * circ : 0;
    const pctMen = total > 0 ? (mensais / total) * circ : 0;
    const pctInat = total > 0 ? (inativos / total) * circ : 0;

    this.circleSemanal.style.strokeDasharray = `${pctSem} ${circ}`;
    this.circleSemanal.style.strokeDashoffset = `0`;

    this.circleQuinzenal.style.strokeDasharray = `${pctQuin} ${circ}`;
    this.circleQuinzenal.style.strokeDashoffset = `-${pctSem}`;

    this.circleMensal.style.strokeDasharray = `${pctMen} ${circ}`;
    this.circleMensal.style.strokeDashoffset = `-${pctSem + pctQuin}`;

    this.circleInativo.style.strokeDasharray = `${pctInat} ${circ}`;
    this.circleInativo.style.strokeDashoffset = `-${pctSem + pctQuin + pctMen}`;
  },

  // --- MOCK SEND WHATSAPP REMINDER ---
  async sendMockReminder(petId, type, buttonEl) {
    if (!this.db.settings.whatsappConnected) {
      this.showToast('WhatsApp Business desconectado nas configurações!', 'danger');
      return;
    }

    const pet = this.db.pets.find(p => p.id === petId);
    const tutor = this.db.customers.find(c => c.id === pet.customer_id);
    if (!pet || !tutor) return;

    buttonEl.disabled = true;
    buttonEl.innerHTML = `
      <svg style="animation: spin 1s linear infinite;" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)"></circle>
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83M2 12h4m12 0h4"></path>
      </svg>
      Sincronizando...
    `;

    // Add visual delay
    setTimeout(async () => {
      const log = await this.db.sendWhatsAppReminder(pet.id, type);
      
      buttonEl.innerHTML = `
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"></path>
        </svg>
        Lembrete Enviado
      `;
      buttonEl.style.background = 'rgba(168,85,247,0.1)';
      buttonEl.style.borderColor = 'rgba(168,85,247,0.3)';
      buttonEl.style.color = 'var(--accent-purple)';

      this.showToast(`Lembrete de *${type.toUpperCase()}* enviado para *${tutor.name}* (${pet.name})!`, 'menta');
      
      // Update background dashboard stats
      if (this.activeView === 'dashboard') {
        this.renderDashboard();
      } else if (this.activeView === 'customers') {
        this.renderCustomersTable();
      }

      // Simulate customer auto reply after 4s (CRM simulation)
      setTimeout(() => {
        this.simulateCustomerReplyAndBooking(log.id, pet, tutor);
      }, 4000);

    }, 1000);
  },

  async simulateCustomerReplyAndBooking(logId, pet, tutor) {
    await this.db.updateLogStatus(logId, 'Respondido');
    
    this.showToast(`💬 *${tutor.name}* respondeu ao lembrete e agendou o banho do *${pet.name}*!`, 'purple');

    // Add responsive simulated check-in reply in DB logs
    if (this.db.isSupabaseActive) {
      await this.db.supabaseClient.from('automations_logs').insert({
        pet_id: pet.id,
        message_type: 'resgate_resposta',
        status: 'Respondido'
      });
      await this.db.fetchRemoteData();
    } else {
      this.db.logs.push({
        id: 'l-reply-' + Date.now(),
        pet_id: pet.id,
        message_type: 'resgate_resposta',
        sent_at: new Date().toISOString(),
        status: 'Respondido'
      });
      this.db.saveLocalDataOnly();
    }

    if (this.activeView === 'dashboard') {
      this.renderDashboard();
    } else if (this.activeView === 'customers') {
      this.renderCustomersTable();
    }

    if (this.selectedPetId === pet.id && this.drawer.classList.contains('active')) {
      this.renderDrawerContent(pet.id);
    }
  },

  // --- AUTOMATIONS PANEL ---
  renderAutomationsView() {
    const triggers = this.db.settings.triggers;
    
    this.toggleTriggerBanho.checked = triggers.banho.enabled;
    this.toggleTriggerVacina.checked = triggers.vacina.enabled;
    this.toggleTriggerSumido.checked = triggers.sumido.enabled;

    this.inputDaysBanho.value = triggers.banho.days;
    this.inputMonthsVacina.value = triggers.vacina.months;
    this.inputDaysSumido.value = triggers.sumido.days;

    this.updateRuleCardState('Banho', triggers.banho.enabled);
    this.updateRuleCardState('Vacina', triggers.vacina.enabled);
    this.updateRuleCardState('Sumido', triggers.sumido.enabled);

    this.switchTemplateTab(this.activeTemplateTab);
  },

  updateTriggerSettings() {
    this.db.settings.triggers.banho.enabled = this.toggleTriggerBanho.checked;
    this.db.settings.triggers.banho.days = parseInt(this.inputDaysBanho.value) || 7;

    this.db.settings.triggers.vacina.enabled = this.toggleTriggerVacina.checked;
    this.db.settings.triggers.vacina.months = parseInt(this.inputMonthsVacina.value) || 3;

    this.db.settings.triggers.sumido.enabled = this.toggleTriggerSumido.checked;
    this.db.settings.triggers.sumido.days = parseInt(this.inputDaysSumido.value) || 45;

    this.db.saveLocalDataOnly();

    this.updateRuleCardState('Banho', this.toggleTriggerBanho.checked);
    this.updateRuleCardState('Vacina', this.toggleTriggerVacina.checked);
    this.updateRuleCardState('Sumido', this.toggleTriggerSumido.checked);

    this.handleTemplateChange();
  },

  updateRuleCardState(name, isEnabled) {
    const card = document.getElementById(`cardTrigger${name}`);
    if (card) {
      if (isEnabled) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    }
  },

  switchTemplateTab(type) {
    this.activeTemplateTab = type;
    
    const tabs = [this.btnTabTemplateBanho, this.btnTabTemplateVacina, this.btnTabTemplateSumido];
    tabs.forEach(tab => {
      if (tab.getAttribute('data-template-type') === type) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.templateTextarea.value = this.db.settings.templates[type];
    this.handleTemplateChange();
  },

  handleTemplateChange() {
    const rawText = this.templateTextarea.value;
    this.db.settings.templates[this.activeTemplateTab] = rawText;
    this.db.saveLocalDataOnly();

    const samplePet = this.db.pets[0] || { name: 'Floquinho' };
    const sampleTutor = this.db.customers[0] || { name: 'Tiago' };

    let days = this.db.settings.triggers.banho.days;
    if (this.activeTemplateTab === 'sumido') days = this.db.settings.triggers.sumido.days;
    if (this.activeTemplateTab === 'vacina') days = this.db.settings.triggers.vacina.months * 30;

    let previewText = rawText
      .replace(/{{dono_nome}}/g, sampleTutor.name)
      .replace(/{{pet_nome}}/g, samplePet.name)
      .replace(/{{dias}}/g, days)
      .replace(/{{link_agenda}}/g, 'petflow.com/s/agendar-banho');

    // Bold tags
    previewText = previewText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    // Breaklines
    previewText = previewText.replace(/\n/g, '<br>');

    this.phoneMockupAvatar.innerText = samplePet.name.charAt(0);
    this.phoneMockupTutorName.innerText = sampleTutor.name;
    this.phoneChatPreviewBubble.innerHTML = `
      ${previewText}
      <span class="chat-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
    `;
  },

  insertTagAtCursor(tag) {
    const txtArea = this.templateTextarea;
    const startPos = txtArea.selectionStart;
    const endPos = txtArea.selectionEnd;
    const text = txtArea.value;

    txtArea.value = text.substring(0, startPos) + tag + text.substring(endPos, text.length);
    txtArea.focus();
    txtArea.selectionStart = startPos + tag.length;
    txtArea.selectionEnd = startPos + tag.length;

    this.handleTemplateChange();
  },

  // --- CUSTOMERS DATABASE TABLE ---
  renderCustomersTable() {
    this.customersTableBody.innerHTML = '';
    
    const searchVal = this.inputTableSearch.value.toLowerCase().trim();
    const filterVal = document.querySelector('.filter-btn.active').getAttribute('data-filter');

    let filteredPets = this.db.pets.filter(pet => {
      const tutor = this.db.customers.find(c => c.id === pet.customer_id) || { name: '', whatsapp: '' };
      
      const matchesSearch = pet.name.toLowerCase().includes(searchVal) ||
                            pet.breed.toLowerCase().includes(searchVal) ||
                            tutor.name.toLowerCase().includes(searchVal) ||
                            tutor.whatsapp.includes(searchVal);

      let matchesFilter = true;
      if (filterVal === 'active') {
        matchesFilter = pet.status === 'active';
      } else if (filterVal === 'alert') {
        matchesFilter = pet.status === 'alert';
      } else if (filterVal === 'inactive') {
        matchesFilter = pet.status === 'inactive';
      }

      return matchesSearch && matchesFilter;
    });

    if (filteredPets.length === 0) {
      this.customersTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            Nenhum cliente ou pet encontrado para os filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    filteredPets.forEach(pet => {
      const tutor = this.db.customers.find(c => c.id === pet.customer_id) || { name: 'Não Cadastrado', whatsapp: '' };
      
      let statusBadge = '';
      let progressClass = '';
      let progressPct = 0;
      
      const lastDate = new Date(pet.last_service_date);
      const diffTime = Math.abs(new Date() - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      progressPct = Math.min(100, (diffDays / pet.frequency_days) * 100);

      if (pet.status === 'active') {
        statusBadge = '<span class="alert-badge success">Ativo</span>';
        progressClass = 'active';
      } else if (pet.status === 'alert') {
        statusBadge = '<span class="alert-badge warning">Alerta Retorno</span>';
        progressClass = 'alert';
      } else {
        statusBadge = '<span class="alert-badge danger">Inativo</span>';
        progressClass = 'inactive';
        progressPct = 100; // full red bar
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding-left: 20px;" onclick="App.openPetDetail('${pet.id}')">
          <div class="table-pet-cell">
            <div class="pet-avatar" style="width: 38px; height: 38px; font-size: 13px;">${pet.name.charAt(0)}</div>
            <div class="table-pet-details">
              <span class="table-pet-name">${pet.name}</span>
              <span class="table-pet-breed">${pet.breed} • ${pet.size}</span>
            </div>
          </div>
        </td>
        <td onclick="App.openPetDetail('${pet.id}')">
          <div class="table-tutor-name">${tutor.name}</div>
          <div class="table-tutor-phone">${tutor.whatsapp}</div>
        </td>
        <td onclick="App.openPetDetail('${pet.id}')">
          <div>${pet.frequency_days} em ${pet.frequency_days} dias</div>
          <div class="cycle-indicator-bar">
            <div class="cycle-indicator-fill ${progressClass}" style="width: ${progressPct}%;"></div>
          </div>
        </td>
        <td onclick="App.openPetDetail('${pet.id}')">
          <div>${this.formatBrazilianDate(pet.last_service_date)}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">há ${diffDays} dias</div>
        </td>
        <td onclick="App.openPetDetail('${pet.id}')">${statusBadge}</td>
        <td>
          <div class="table-actions" style="justify-content: center;">
            <button class="btn-icon-table" title="Visualizar Timeline" onclick="App.openPetDetail('${pet.id}')">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </button>
            <button class="btn-icon-table delete" title="Excluir Pet" onclick="App.deletePetRow('${pet.id}', event)">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </td>
      `;
      this.customersTableBody.appendChild(tr);
    });
  },

  async deletePetRow(petId, event) {
    event.stopPropagation();
    if (confirm('Deseja realmente excluir este pet e seu tutor?')) {
      const success = await this.db.deletePet(petId);
      if (success) {
        this.showToast('Pet removido com sucesso!', 'purple');
        this.renderCustomersTable();
      } else {
        this.showToast('Erro ao remover o pet!', 'danger');
      }
    }
  },

  // --- SETTINGS VIEW ---
  renderSettingsView() {
    this.updateWhatsAppStatusUI();
    this.updateSupabaseStatusUI();
  },

  async handleSaveSupabaseConfig() {
    const url = this.inputSupabaseUrl.value.trim();
    const key = this.inputSupabaseAnonKey.value.trim();

    if (!url || !key) {
      // Disconnect
      this.db.disconnectSupabase();
      this.updateSupabaseStatusUI();
      this.showToast('Credenciais removidas. Retornando ao Modo Local.', 'purple');
      this.render();
      return;
    }

    this.btnSaveSupabaseConfig.disabled = true;
    this.btnSaveSupabaseConfig.innerText = 'Sincronizando...';
    this.supabaseStatusText.innerText = 'Testando conexão Supabase...';
    this.supabaseStatusText.style.color = 'var(--text-secondary)';

    const res = await this.db.connectToSupabase(url, key);

    this.btnSaveSupabaseConfig.disabled = false;
    this.btnSaveSupabaseConfig.innerText = 'Salvar e Conectar';

    if (res.success) {
      this.showToast('Banco Supabase conectado e sincronizado! ✅', 'menta');
      this.updateSupabaseStatusUI();
      this.render(); // Redraw UI with live Supabase data
    } else {
      this.showToast(`Erro na conexão: ${res.error}`, 'danger');
      this.updateSupabaseStatusUI();
    }
  },

  updateSupabaseStatusUI() {
    if (this.db.isSupabaseActive) {
      this.supabaseStatusText.innerHTML = `Conectado ao Nile Site (Schema: <span style="color:var(--accent-menta);">petflow</span>) ✅`;
      this.supabaseStatusText.style.color = 'var(--accent-menta)';
      this.btnSaveSupabaseConfig.style.background = 'linear-gradient(135deg, var(--accent-purple), #7c3aed)';
      this.btnSaveSupabaseConfig.style.color = '#fff';
      this.btnSaveSupabaseConfig.innerText = 'Desconectar Banco';
    } else {
      this.supabaseStatusText.innerText = 'Offline • Modo Demonstrativo Local';
      this.supabaseStatusText.style.color = 'var(--text-muted)';
      this.btnSaveSupabaseConfig.style.background = 'linear-gradient(135deg, var(--accent-menta), #059669)';
      this.btnSaveSupabaseConfig.style.color = '#000';
      this.btnSaveSupabaseConfig.innerText = 'Salvar e Conectar';
    }
  },

  // --- WHATSAPP CONNECTION SYNC MOCKS ---
  handleToggleWhatsAppConnection() {
    const state = this.db.settings.whatsappConnected;
    if (state) {
      this.db.settings.whatsappConnected = false;
      this.db.saveLocalDataOnly();
      this.updateWhatsAppStatusUI();
      this.showToast('WhatsApp Business Desconectado!', 'danger');
    } else {
      this.reconnectWhatsApp();
    }
  },

  reconnectWhatsApp() {
    this.qrOverlay.classList.add('visible');
    this.qrOverlayText.innerText = 'Sincronizando...';

    setTimeout(() => {
      this.db.settings.whatsappConnected = true;
      this.db.saveLocalDataOnly();
      this.qrOverlay.classList.remove('visible');
      this.updateWhatsAppStatusUI();
      this.showToast('WhatsApp Pareado com Sucesso!', 'menta');
    }, 2000);
  },

  updateWhatsAppStatusUI() {
    const isConnected = this.db.settings.whatsappConnected;
    
    if (isConnected) {
      this.whatsStatusBadge.style.backgroundColor = 'rgba(0, 245, 160, 0.08)';
      this.whatsStatusBadge.style.borderColor = 'rgba(0, 245, 160, 0.2)';
      this.whatsStatusBadge.style.color = 'var(--accent-menta)';
      this.whatsStatusText.innerText = 'WhatsApp Conectado';
      this.whatsPulseDot.style.backgroundColor = 'var(--accent-menta)';
      this.whatsPulseDot.style.boxShadow = '0 0 10px var(--accent-menta)';

      this.qrOverlay.classList.remove('visible');
      this.qrStatusDot.className = 'qr-status-dot connected';
      this.qrStatusLabel.innerText = 'Conectado e Operacional';
      this.btnToggleConnection.innerText = 'Desconectar Aparelho';
      this.btnToggleConnection.className = 'btn-secondary';
      this.qrImage.style.opacity = '0.15';
    } else {
      this.whatsStatusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
      this.whatsStatusBadge.style.borderColor = 'rgba(239, 68, 68, 0.2)';
      this.whatsStatusBadge.style.color = 'var(--accent-red)';
      this.whatsStatusText.innerText = 'Aparelho Desconectado';
      this.whatsPulseDot.style.backgroundColor = 'var(--accent-red)';
      this.whatsPulseDot.style.boxShadow = '0 0 10px var(--accent-red)';

      this.qrStatusDot.className = 'qr-status-dot disconnected';
      this.qrStatusLabel.innerText = 'Aguardando Leitura...';
      this.btnToggleConnection.innerText = 'Conectar Aparelho';
      this.btnToggleConnection.className = 'btn-primary';
      this.qrImage.style.opacity = '1';
    }
  },

  // --- ADD PET MODAL DIALOGS ---
  toggleAddPetModal(open) {
    if (open) {
      document.getElementById('formPetLastService').value = new Date().toISOString().split('T')[0];
      this.addPetModalBackdrop.classList.add('active');
    } else {
      this.addPetModalBackdrop.classList.remove('active');
      this.addPetForm.reset();
    }
  },

  async handleSubmittedPetForm(e) {
    e.preventDefault();
    
    const tutorName = document.getElementById('formTutorName').value.trim();
    const tutorWhatsapp = document.getElementById('formTutorWhatsapp').value.trim();
    const tutorAddress = document.getElementById('formTutorAddress').value.trim();

    const petName = document.getElementById('formPetName').value.trim();
    const petBreed = document.getElementById('formPetBreed').value.trim();
    const petSize = document.getElementById('formPetSize').value;
    const petCoat = document.getElementById('formPetCoat').value;
    const petFrequency = document.getElementById('formPetFrequency').value;
    const petLastService = document.getElementById('formPetLastService').value;

    const customerData = { name: tutorName, whatsapp: tutorWhatsapp, address: tutorAddress };
    const petData = { name: petName, breed: petBreed, size: petSize, coat_type: petCoat, frequency_days: petFrequency, last_service_date: petLastService };

    try {
      this.showToast('Salvando cadastro...', 'purple');
      await this.db.addCustomerAndPet(customerData, petData);

      this.showToast(`Pet *${petName}* e Tutor *${tutorName}* cadastrados com sucesso!`, 'menta');
      this.toggleAddPetModal(false);
      
      this.render();
    } catch(err) {
      this.showToast(`Erro ao cadastrar: ${err.message}`, 'danger');
    }
  },

  // --- TIMELINE DRAWER ---
  openPetDetail(petId) {
    this.selectedPetId = petId;
    this.toggleDrawer(true);
    this.renderDrawerContent(petId);
  },

  toggleDrawer(open) {
    if (open) {
      this.drawerBackdrop.classList.add('active');
      this.drawer.classList.add('active');
    } else {
      this.drawerBackdrop.classList.remove('active');
      this.drawer.classList.remove('active');
      this.selectedPetId = null;
    }
  },

  renderDrawerContent(petId) {
    const pet = this.db.pets.find(p => p.id === petId);
    if (!pet) return;

    const tutor = this.db.customers.find(c => c.id === pet.customer_id) || { name: 'Não Cadastrado', whatsapp: '' };

    this.drawerPetAvatar.innerText = pet.name.charAt(0);
    this.drawerPetName.innerText = pet.name;
    this.drawerTutorName.innerText = `Tutor(a): ${tutor.name} | ${tutor.whatsapp}`;

    this.drawerPetBreed.innerText = `${pet.breed} (${pet.size})`;
    this.drawerPetCoat.innerText = pet.coat_type;
    this.drawerPetFrequency.innerText = `${pet.frequency_days} em ${pet.frequency_days} dias`;
    this.drawerPetLastService.innerText = this.formatBrazilianDate(pet.last_service_date);

    // Get logs chronological order
    const petLogs = this.db.logs.filter(l => l.pet_id === petId).sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

    this.drawerTimeline.innerHTML = '';
    
    if (petLogs.length === 0) {
      this.drawerTimeline.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px;">Nenhuma atividade registrada na timeline.</p>';
      return;
    }

    petLogs.forEach(log => {
      let title = '';
      let desc = '';
      let itemClass = '';
      
      const timeStr = this.formatBrazilianDateTime(log.sent_at);

      if (log.message_type === 'cadastro') {
        title = 'Cadastro Realizado';
        desc = 'Ficha cadastral do pet e tutor cadastrados com sucesso na base.';
        itemClass = 'blue';
      } else if (log.message_type === 'banho_concluido') {
        title = 'Serviço Concluído';
        desc = 'Banho e Tosa executados. O ciclo de recorrência ideal foi resetado.';
        itemClass = 'success';
      } else if (log.message_type === 'banho') {
        title = 'Lembrete de Banho Enviado';
        desc = `Mensagem enviada via WhatsApp. Status: <strong>${log.status}</strong>.`;
        itemClass = log.status === 'Respondido' ? 'success' : 'purple';
      } else if (log.message_type === 'vacina') {
        title = 'Aviso de Vacinação';
        desc = `Aviso de vacina e vermífugo disparado via WhatsApp. Status: <strong>${log.status}</strong>.`;
        itemClass = log.status === 'Respondido' ? 'success' : 'purple';
      } else if (log.message_type === 'sumido') {
        title = 'Mensagem de Resgate';
        desc = `Campanha de Cliente Sumido disparada (+45 dias de ausência). Status: <strong>${log.status}</strong>.`;
        itemClass = log.status === 'Respondido' ? 'success' : 'danger';
      } else if (log.message_type === 'resgate_resposta') {
        title = 'Cliente Agendou! 💵';
        desc = 'Tutor respondeu à mensagem do robô e agendou um horário na semana.';
        itemClass = 'success';
      } else {
        title = 'Log do Sistema';
        desc = `Ação registrada de ${log.message_type}.`;
        itemClass = 'blue';
      }

      const timelineItem = document.createElement('div');
      timelineItem.className = `timeline-item ${itemClass}`;
      timelineItem.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-body">
          <div class="timeline-header-row">
            <span class="timeline-act-title">${title}</span>
            <span class="timeline-time">${timeStr}</span>
          </div>
          <p class="timeline-desc">${desc}</p>
        </div>
      `;
      this.drawerTimeline.appendChild(timelineItem);
    });
  },

  async handleDrawerRecordService() {
    if (!this.selectedPetId) return;
    
    this.showToast('Registrando serviço...', 'purple');
    const success = await this.db.recordService(this.selectedPetId);
    if (success) {
      const pet = this.db.pets.find(p => p.id === this.selectedPetId);
      this.showToast(`Serviço de Banho registrado para *${pet.name}*!`, 'menta');
      
      this.renderDrawerContent(this.selectedPetId);
      this.render();
    }
  },

  handleDrawerWhatsApp() {
    if (!this.selectedPetId) return;
    const pet = this.db.pets.find(p => p.id === this.selectedPetId);
    if (!pet) return;

    let type = pet.status === 'inactive' ? 'sumido' : 'banho';
    this.sendMockReminder(pet.id, type, this.btnDrawerWhatsApp);
  },

  // --- SYSTEM TOAST NOTIFICATIONS ---
  showToast(message, type = 'menta') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'menta') {
      icon = `
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"></path>
        </svg>
      `;
    } else if (type === 'purple') {
      icon = `
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 10.742l1.99 2.049 4.642-4.79m-.64 6.749L12 18l-3.32-3.25m6.64 0H8.68"></path>
        </svg>
      `;
    } else {
      icon = `
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      `;
    }

    const formattedMessage = message.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

    toast.innerHTML = `
      ${icon}
      <span>${formattedMessage}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4500);
  },

  // --- HELPERS ---
  formatBrazilianDate(isoString) {
    if (!isoString) return '-';
    const parts = isoString.split('-');
    if (parts.length !== 3) return isoString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  formatBrazilianDateTime(isoDateTime) {
    if (!isoDateTime) return '';
    const date = new Date(isoDateTime);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month} às ${hours}:${minutes}`;
  },

  render() {
    this.renderDashboard();
    this.updateWhatsAppStatusUI();
    this.updateSupabaseStatusUI();
  }
};

// Start application when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
