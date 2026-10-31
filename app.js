(() => {
  'use strict';

  /* =========================================================
     Constants & tiny helpers
     ========================================================= */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const PALETTE = ['#3E7C6C', '#C17A4A', '#5B72B5', '#A25B6B', '#8A7A45', '#4C6B7A'];
  const PRIORITIES = ['low', 'normal', 'high'];
  const PRIORITY_LABELS = { low: '不急', normal: '普通', high: '优先' };
  const MAX_ZONES = 6;
  const MAX_VISIBLE_EVENTS = 4;

  const VIEWS = {
    day: { label: '日', unit: '天', count: 7, step: 7 },
    week: { label: '周', unit: '周', count: 6, step: 42 },
    month: { label: '月', unit: '个月', count: 6, step: 6 },
    year: { label: '年', unit: '年', count: 5, step: 5 }
  };

  const STORAGE = {
    accounts: 'shixu.accounts.v1',
    activeAccount: 'shixu.activeAccount.v1',
    workspace: (id) => `shixu.workspace.v1.${id}`,
    ui: 'shixu.ui.v1'
  };

  const CLOUD = {
    metaPrefix: 'shixu.cloud.v1.',
    pollMs: 6000,
    pushDelay: 1100,
    requestTimeout: 12000,
    healthTimeout: 4000,
    defaultPort: 8787
  };

  const GUEST = { id: 'guest', name: '本机访客', guest: true };

  const icon = (name, className = '') =>
    `<svg class="icon${className ? ` ${className}` : ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  const pad2 = (number) => String(number).padStart(2, '0');

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const escapeHTML = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));

  const esc = escapeHTML;

  const deepClone = (value) => JSON.parse(JSON.stringify(value));

  function uid(prefix = 'id') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    }
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function safeColor(value, fallback = PALETTE[0]) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  function initials(name) {
    const characters = Array.from(String(name || '').trim());
    if (!characters.length) return '访';
    const first = characters[0];
    return /[a-z]/i.test(first) ? first.toUpperCase() : first;
  }

  function normalizeText(value, maxLength) {
    return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, maxLength);
  }

  /* =========================================================
     Dates
     ========================================================= */

  function parseISO(iso) {
    const parts = String(iso || '').split('-').map(Number);
    return new Date(parts[0] || 1970, (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function todayISO() {
    return toISO(new Date());
  }

  function addDays(iso, count) {
    const date = parseISO(iso);
    date.setDate(date.getDate() + count);
    return toISO(date);
  }

  function addMonthsISO(iso, count) {
    const date = parseISO(iso);
    const firstOfTarget = new Date(date.getFullYear(), date.getMonth() + count, 1, 12);
    const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0, 12).getDate();
    return toISO(new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(date.getDate(), lastDay), 12));
  }

  function startOfWeek(iso) {
    const date = parseISO(iso);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return toISO(date);
  }

  function startOfMonth(iso) {
    const date = parseISO(iso);
    return toISO(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  }

  function weekdayIndex(iso) {
    return (parseISO(iso).getDay() + 6) % 7;
  }

  function weekNumber(iso) {
    const date = parseISO(iso);
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNumber + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
    return 1 + Math.round((target - firstThursday) / 604800000);
  }

  function isValidISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = parseISO(value);
    return toISO(date) === value;
  }

  function isInRange(iso, startISO, endISO) {
    return iso >= startISO && iso <= endISO;
  }

  function formatMonthDay(iso) {
    const date = parseISO(iso);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatClock(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function completionLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '刚刚';
    const day = toISO(date);
    const today = todayISO();
    const yesterday = addDays(today, -1);
    if (day === today) return `今天 ${formatClock(date)}`;
    if (day === yesterday) return `昨天 ${formatClock(date)}`;
    return `${date.getMonth() + 1}月${date.getDate()}日 ${formatClock(date)}`;
  }

  function formatWeekSpan(startISO, endISO) {
    const start = parseISO(startISO);
    const end = parseISO(endISO);
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getDate()}日`;
    }
    return `${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
  }

  function formatDisplayRange(view, periods) {
    if (!periods.length) return '';
    const first = periods[0];
    const last = periods[periods.length - 1];
    const start = parseISO(first.startISO);
    const end = parseISO(last.endISO);

    if (view === 'year') return `${start.getFullYear()} – ${end.getFullYear()}`;
    if (view === 'month') {
      if (start.getFullYear() === end.getFullYear()) {
        return `${start.getFullYear()}年${start.getMonth() + 1}月 – ${end.getMonth() + 1}月`;
      }
      return `${start.getFullYear()}年${start.getMonth() + 1}月 – ${end.getFullYear()}年${end.getMonth() + 1}月`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
    }
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 – ${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;
  }

  /* =========================================================
     DOM references
     ========================================================= */

  const el = {
    sidebar: $('#sidebar'),
    sidebarClose: $('#sidebarClose'),
    sidebarScrim: $('#sidebarScrim'),
    menuBtn: $('#menuBtn'),
    timelineList: $('#timelineList'),
    newTimelineBtn: $('#newTimelineBtn'),
    newTimelineBtn2: $('#newTimelineBtn2'),
    storageStatus: $('#storageStatus'),
    savedTime: $('#savedTime'),
    accountCard: $('#accountCard'),
    accountAvatar: $('#accountAvatar'),
    accountName: $('#accountName'),
    accountSubtitle: $('#accountSubtitle'),
    accountTop: $('#accountTop'),
    accountTopAvatar: $('#accountTopAvatar'),
    timelineDot: $('#timelineDot'),
    timelineTitle: $('#timelineTitle'),
    timelineNote: $('#timelineNote'),
    editTimelineBtn: $('#editTimelineBtn'),
    manageZonesBtn: $('#manageZonesBtn'),
    addEventBtn: $('#addEventBtn'),
    viewSwitch: $('#viewSwitch'),
    prevRange: $('#prevRange'),
    nextRange: $('#nextRange'),
    todayBtn: $('#todayBtn'),
    rangeLabel: $('#rangeLabel'),
    rangeSub: $('#rangeSub'),
    doneToggle: $('#doneToggle'),
    doneCountBadge: $('#doneCountBadge'),
    boardScroller: $('#boardScroller'),
    boardEmpty: $('#boardEmpty'),
    emptyAddBtn: $('#emptyAddBtn'),
    donePanel: $('#donePanel'),
    doneClose: $('#doneClose'),
    doneBackdrop: $('#doneBackdrop'),
    progressLabel: $('#progressLabel'),
    progressPercent: $('#progressPercent'),
    progressBar: $('#progressBar'),
    progressFill: $('#progressFill'),
    doneTotalLabel: $('#doneTotalLabel'),
    pendingTodayLabel: $('#pendingTodayLabel'),
    doneList: $('#doneList'),
    clearDoneBtn: $('#clearDoneBtn'),
    dragHint: $('#dragHint'),
    dragDoneTarget: $('#dragDoneTarget'),
    dragGhostLayer: $('#dragGhostLayer'),
    modal: $('#modal'),
    modalDialog: $('#modalDialog'),
    modalTitle: $('#modalTitle'),
    modalKicker: $('#modalKicker'),
    modalBody: $('#modalBody'),
    modalFoot: $('#modalFoot'),
    modalClose: $('#modalClose'),
    confirmModal: $('#confirmModal'),
    confirmTitle: $('#confirmTitle'),
    confirmMessage: $('#confirmMessage'),
    confirmCancel: $('#confirmCancel'),
    confirmOk: $('#confirmOk'),
    toastStack: $('#toastStack')
  };

  /* =========================================================
     Persistence
     ========================================================= */

  let storageBroken = false;
  let storageWarningShown = false;

  function readLocal(key, fallback = null) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      storageBroken = true;
      return fallback;
    }
  }

  function writeLocal(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      storageBroken = true;
      return false;
    }
  }

  function readJSON(key, fallback) {
    const raw = readLocal(key, null);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  /* =========================================================
     Workspace data
     ========================================================= */

  let state = null;
  let accounts = [];
  let currentAccountId = 'guest';
  let currentPeriods = [];
  let lastSavedAt = null;

  let ui = {
    view: 'week',
    anchor: todayISO(),
    expanded: {}
  };

  let cloud = {
    token: '',
    username: '',
    serverUrl: '',
    revision: 0,
    dirty: false,
    lastSyncedAt: null,
    autoSync: true,
    status: 'disconnected',
    error: '',
    busy: false,
    tracking: false,
    conflict: null
  };

  let cloudPollTimer = null;
  let cloudPushTimer = null;
  let cloudRetryTimer = null;
  let cloudPendingLink = null;
  let cloudSuppressDirty = false;
  let cloudGeneration = 0;

  let deferredInstallPrompt = null;
  let swReady = false;
  let swRegistrationError = false;
  let pwaHintTimer = null;
  let cloudModalState = {
    formOpen: false,
    mode: 'login',
    busy: false
  };

  function makeDefaultZones() {
    return [
      { id: uid('z'), name: '工作', color: '#3E7C6C' },
      { id: uid('z'), name: '生活', color: '#C17A4A' },
      { id: uid('z'), name: '学习', color: '#5B72B5' }
    ];
  }

  function createDefaultWorkspace() {
    const zones = makeDefaultZones();
    const timeline = {
      id: uid('tl'),
      name: '我的时序',
      note: '把重要的事，放到看得见的时间里。',
      color: PALETTE[0],
      zones,
      events: [],
      updatedAt: new Date().toISOString()
    };
    return {
      version: 1,
      activeTimelineId: timeline.id,
      timelines: [timeline]
    };
  }

  function atLocal(iso, hours = 9, minutes = 0) {
    const date = parseISO(iso);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  }

  function createSeedWorkspace() {
    const today = todayISO();
    const now = Date.now();

    const firstZones = makeDefaultZones();
    const first = {
      id: uid('tl'),
      name: '我的时序',
      note: '工作、生活与学习，都在同一条线上。',
      color: '#3E7C6C',
      zones: firstZones,
      events: [],
      updatedAt: new Date(now - 6 * 86400000).toISOString()
    };

    let order = 0;
    const add = (timeline, options) => {
      const zone = timeline.zones[options.zone] || timeline.zones[0];
      const date = options.date || today;
      timeline.events.push({
        id: uid('e'),
        title: options.title,
        note: options.note || '',
        date,
        zoneId: zone.id,
        priority: options.priority || 'normal',
        done: Boolean(options.done),
        completedAt: options.done
          ? (options.completedAt || new Date(now - (3 + order) * 3600000).toISOString())
          : null,
        createdAt: new Date(now - (order + 2) * 7200000).toISOString(),
        updatedAt: new Date(now - (order + 1) * 3600000).toISOString()
      });
      order += 1;
    };

    add(first, {
      title: '梳理 Q4 产品路线图',
      note: '先整理用户反馈，再补一版优先级。',
      date: today,
      zone: 0,
      priority: 'high'
    });
    add(first, {
      title: '预约牙医复诊',
      note: '下周三下午两点之后都可以。',
      date: today,
      zone: 1
    });
    add(first, {
      title: '读《深度工作》第 3 章',
      note: '做三页摘录，顺手把想法记下来。',
      date: today,
      zone: 2
    });
    add(first, {
      title: '和周宁同步设计稿',
      note: '重点确认空状态和移动端手势。',
      date: addDays(today, 1),
      zone: 0
    });
    add(first, {
      title: '给阳台绿植换盆',
      date: addDays(today, 1),
      zone: 1,
      priority: 'low'
    });
    add(first, {
      title: '提交季度复盘初稿',
      note: '把本周的三个关键判断写进结论。',
      date: addDays(today, 2),
      zone: 0,
      priority: 'high'
    });
    add(first, {
      title: '整理读书会讨论提纲',
      date: addDays(today, 4),
      zone: 2
    });
    add(first, {
      title: '年度体检预约',
      date: addDays(today, 8),
      zone: 1
    });
    add(first, {
      title: '晨跑 5 公里',
      date: today,
      zone: 1,
      done: true,
      completedAt: new Date(now - 3.4 * 3600000).toISOString()
    });
    add(first, {
      title: '清理收件箱',
      date: addDays(today, -1),
      zone: 0,
      done: true,
      completedAt: atLocal(addDays(today, -1), 18, 40)
    });
    add(first, {
      title: '整理桌面文件',
      date: addDays(today, -1),
      zone: 0,
      priority: 'low',
      done: true,
      completedAt: atLocal(addDays(today, -1), 16, 15)
    });

    const readingZones = makeDefaultZones();
    const reading = {
      id: uid('tl'),
      name: '读书计划',
      note: '把输入，慢慢变成自己的东西。',
      color: '#5B72B5',
      zones: readingZones,
      events: [],
      updatedAt: new Date(now - 5 * 86400000).toISOString()
    };
    add(reading, {
      title: '读完《人类简史》第二部分',
      note: '重点关注农业革命那几章。',
      date: today,
      zone: 2,
      priority: 'high'
    });
    add(reading, {
      title: '摘录 5 条有启发的句子',
      date: addDays(today, 1),
      zone: 2
    });
    add(reading, {
      title: '整理本月读书笔记',
      date: addDays(today, 3),
      zone: 2
    });
    add(reading, {
      title: '选好十一月共读书目',
      date: addDays(today, 9),
      zone: 2,
      priority: 'low'
    });
    add(reading, {
      title: '读完《深度工作》前言',
      date: addDays(today, -2),
      zone: 2,
      done: true,
      completedAt: atLocal(addDays(today, -2), 21, 10)
    });

    const lifeZones = makeDefaultZones();
    const life = {
      id: uid('tl'),
      name: '生活实验',
      note: '小步尝试，慢慢喜欢。',
      color: '#C17A4A',
      zones: lifeZones,
      events: [],
      updatedAt: new Date(now - 4 * 86400000).toISOString()
    };
    add(life, {
      title: '尝试 20 分钟晨间拉伸',
      date: today,
      zone: 1
    });
    add(life, {
      title: '做一次无手机晚餐',
      date: addDays(today, 2),
      zone: 1
    });
    add(life, {
      title: '复盘本周睡眠记录',
      date: addDays(today, 6),
      zone: 1
    });
    add(life, {
      title: '买一束花放在书桌',
      date: today,
      zone: 1,
      done: true,
      completedAt: new Date(now - 1.2 * 3600000).toISOString()
    });

    return {
      version: 1,
      activeTimelineId: first.id,
      timelines: [first, reading, life]
    };
  }

  function normalizeEvent(raw, zones) {
    if (!raw || typeof raw !== 'object') return null;
    const title = normalizeText(raw.title, 90);
    if (!title) return null;
    const date = isValidISODate(raw.date) ? raw.date : todayISO();
    const zoneIds = new Set(zones.map((zone) => zone.id));
    const zoneId = zoneIds.has(String(raw.zoneId)) ? String(raw.zoneId) : zones[0].id;
    const done = Boolean(raw.done);
    let completedAt = raw.completedAt;
    if (done && (!completedAt || Number.isNaN(new Date(completedAt).getTime()))) {
      completedAt = new Date().toISOString();
    }
    if (!done) completedAt = null;
    const priority = PRIORITIES.includes(raw.priority) ? raw.priority : 'normal';
    return {
      id: normalizeText(raw.id, 80) || uid('e'),
      title,
      note: normalizeText(raw.note, 500),
      date,
      zoneId,
      priority,
      done,
      completedAt,
      createdAt: Number.isNaN(new Date(raw.createdAt).getTime()) ? new Date().toISOString() : raw.createdAt,
      updatedAt: Number.isNaN(new Date(raw.updatedAt).getTime()) ? new Date().toISOString() : raw.updatedAt
    };
  }

  function normalizeTimeline(raw, index) {
    if (!raw || typeof raw !== 'object') return null;

    const usedZoneIds = new Set();
    let zones = Array.isArray(raw.zones)
      ? raw.zones.slice(0, MAX_ZONES).map((zone) => {
          if (!zone || typeof zone !== 'object') return null;
          let id = normalizeText(zone.id, 80) || uid('z');
          if (usedZoneIds.has(id)) id = uid('z');
          usedZoneIds.add(id);
          return {
            id,
            name: normalizeText(zone.name, 10) || '未命名区域',
            color: safeColor(zone.color, PALETTE[usedZoneIds.size % PALETTE.length])
          };
        }).filter(Boolean)
      : [];

    if (!zones.length) zones = makeDefaultZones();

    const events = Array.isArray(raw.events)
      ? raw.events.map((event) => normalizeEvent(event, zones)).filter(Boolean)
      : [];

    return {
      id: normalizeText(raw.id, 80) || uid('tl'),
      name: normalizeText(raw.name, 32) || `时间轴 ${index + 1}`,
      note: normalizeText(raw.note, 120),
      color: safeColor(raw.color, PALETTE[index % PALETTE.length]),
      zones,
      events,
      updatedAt: Number.isNaN(new Date(raw.updatedAt).getTime()) ? '' : raw.updatedAt
    };
  }

  function normalizeWorkspace(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.timelines)) {
      return createDefaultWorkspace();
    }
    const timelines = raw.timelines.slice(0, 20).map(normalizeTimeline).filter(Boolean);
    if (!timelines.length) return createDefaultWorkspace();
    let activeTimelineId = String(raw.activeTimelineId || '');
    if (!timelines.some((timeline) => timeline.id === activeTimelineId)) {
      activeTimelineId = timelines[0].id;
    }
    return { version: 1, activeTimelineId, timelines };
  }

  function loadWorkspaceFor(accountId) {
    const raw = readJSON(STORAGE.workspace(accountId), null);
    if (raw) return normalizeWorkspace(raw);
    return accountId === 'guest' ? createSeedWorkspace() : createDefaultWorkspace();
  }

  function loadAccounts() {
    const raw = readJSON(STORAGE.accounts, []);
    if (!Array.isArray(raw)) return [];
    return raw.map((account) => {
      if (!account || typeof account !== 'object') return null;
      const id = normalizeText(account.id, 80);
      const name = normalizeText(account.name, 24);
      if (!id || !name || id === 'guest') return null;
      return { id, name, createdAt: account.createdAt || new Date().toISOString() };
    }).filter(Boolean);
  }

  function loadUi() {
    const raw = readJSON(STORAGE.ui, null);
    const view = raw && Object.prototype.hasOwnProperty.call(VIEWS, raw.view) ? raw.view : 'week';
    const anchor = raw && isValidISODate(raw.anchor) ? raw.anchor : todayISO();
    return { view, anchor, expanded: {} };
  }

  function getCurrentAccount() {
    if (currentAccountId === 'guest') return GUEST;
    return accounts.find((account) => account.id === currentAccountId) || GUEST;
  }

  function getTimeline() {
    if (!state) return null;
    return state.timelines.find((timeline) => timeline.id === state.activeTimelineId) || state.timelines[0] || null;
  }

  function persistAccounts() {
    writeLocal(STORAGE.accounts, JSON.stringify(accounts));
  }

  function persistActiveAccount() {
    writeLocal(STORAGE.activeAccount, currentAccountId);
  }

  function persistUi() {
    writeLocal(STORAGE.ui, JSON.stringify({ view: ui.view, anchor: ui.anchor }));
  }

  function saveWorkspace(silent = false) {
    if (!state) return;
    const ok = writeLocal(STORAGE.workspace(currentAccountId), JSON.stringify(state));
    if (ok) {
      storageBroken = false;
      lastSavedAt = new Date();
    }
    if (cloud.tracking && cloud.token && !cloudSuppressDirty) {
      cloud.dirty = true;
      saveCloudMeta();
      if (!cloud.busy && !['conflict', 'auth', 'offline', 'error', 'syncing'].includes(cloud.status)) {
        cloud.status = 'pending';
      }
      scheduleCloudPush();
    }
    updateCloudIndicators();
    if (!ok && !silent) showStorageWarning();
  }

  function showStorageWarning() {
    if (storageWarningShown) return;
    storageWarningShown = true;
    showToast('浏览器限制了本地存储，本次改动可能无法保留。请检查隐私设置。', {
      icon: 'flag',
      duration: 7000
    });
  }

  /* =========================================================
     Periods & grouping
     ========================================================= */

  function buildPeriods(view, anchorISO) {
    const today = todayISO();
    const config = VIEWS[view] || VIEWS.week;
    const anchor = isValidISODate(anchorISO) ? anchorISO : today;
    const periods = [];

    if (view === 'day') {
      for (let index = 0; index < config.count; index += 1) {
        const iso = addDays(anchor, index);
        const date = parseISO(iso);
        periods.push({
          key: `day:${iso}`,
          startISO: iso,
          endISO: iso,
          defaultDate: iso,
          eyebrow: WEEKDAYS[date.getDay()],
          title: `${date.getMonth() + 1}月${date.getDate()}日`,
          subline: `${date.getFullYear()}年 · 第 ${weekNumber(iso)} 周`,
          isCurrent: iso === today,
          isPast: iso < today
        });
      }
      return periods;
    }

    if (view === 'week') {
      const start = startOfWeek(anchor);
      for (let index = 0; index < config.count; index += 1) {
        const startISO = addDays(start, index * 7);
        const endISO = addDays(startISO, 6);
        const isCurrent = isInRange(today, startISO, endISO);
        const date = parseISO(startISO);
        periods.push({
          key: `week:${startISO}`,
          startISO,
          endISO,
          defaultDate: isCurrent ? today : startISO,
          eyebrow: `第 ${weekNumber(startISO)} 周`,
          title: formatWeekSpan(startISO, endISO),
          subline: `${date.getFullYear()} 年`,
          isCurrent,
          isPast: endISO < today
        });
      }
      return periods;
    }

    if (view === 'month') {
      const anchorDate = parseISO(anchor);
      for (let index = 0; index < config.count; index += 1) {
        const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + index, 1, 12);
        const startISO = toISO(date);
        const endISO = toISO(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
        const isCurrent = isInRange(today, startISO, endISO);
        periods.push({
          key: `month:${date.getFullYear()}-${pad2(date.getMonth() + 1)}`,
          startISO,
          endISO,
          defaultDate: isCurrent ? today : startISO,
          eyebrow: `${date.getFullYear()} 年`,
          title: `${date.getMonth() + 1}月`,
          subline: `${parseISO(endISO).getDate()} 天`,
          isCurrent,
          isPast: endISO < today
        });
      }
      return periods;
    }

    const startYear = parseISO(anchor).getFullYear();
    for (let index = 0; index < config.count; index += 1) {
      const year = startYear + index;
      const startISO = `${year}-01-01`;
      const endISO = `${year}-12-31`;
      const isCurrent = isInRange(today, startISO, endISO);
      periods.push({
        key: `year:${year}`,
        startISO,
        endISO,
        defaultDate: isCurrent ? today : startISO,
        eyebrow: '年度节点',
        title: `${year}`,
        subline: `${year} 年`,
        isCurrent,
        isPast: endISO < today
      });
    }
    return periods;
  }

  function sortZoneEvents(events) {
    const weights = { high: 0, normal: 1, low: 2 };
    return [...events].sort((first, second) => {
      if (first.date !== second.date) return first.date.localeCompare(second.date);
      const weightDifference = (weights[first.priority] ?? 1) - (weights[second.priority] ?? 1);
      if (weightDifference !== 0) return weightDifference;
      return String(first.createdAt).localeCompare(String(second.createdAt));
    });
  }

  function getDoneEvents(timeline) {
    return timeline.events
      .filter((event) => event.done)
      .sort((first, second) => {
        const firstTime = new Date(first.completedAt || first.updatedAt || 0).getTime();
        const secondTime = new Date(second.completedAt || second.updatedAt || 0).getTime();
        return secondTime - firstTime;
      });
  }

  /* =========================================================
     Rendering
     ========================================================= */

  function renderAll(options = {}) {
    if (!state) return;
    currentPeriods = buildPeriods(ui.view, ui.anchor);
    renderSidebar();
    renderHeader();
    renderToolbar();
    renderBoard({ preserveScroll: options.preserveBoardScroll !== false });
    renderDone();
    updateSaveStatus();
    const timeline = getTimeline();
    document.title = timeline ? `${timeline.name} · 时序` : '时序 · 时间轴待办';
    requestAnimationFrame(updateSegmentIndicator);
  }

  function renderSidebar() {
    const timeline = getTimeline();
    if (!timeline) return;

    el.timelineList.innerHTML = state.timelines.map((item) => {
      const pending = item.events.filter((event) => !event.done).length;
      const active = item.id === state.activeTimelineId;
      return `
        <button class="timeline-item${active ? ' is-active' : ''}" type="button"
          data-timeline-id="${esc(item.id)}" ${active ? 'aria-current="true"' : ''}
          aria-label="切换到 ${esc(item.name)}，${pending} 项待办">
          <span class="dot" style="--dot-color:${safeColor(item.color)}"></span>
          <span class="item-copy">
            <span class="item-name">${esc(item.name)}</span>
            <span class="item-meta">${pending ? `${pending} 项待办` : '暂无待办'}</span>
          </span>
          <span class="item-count">${pending}</span>
        </button>
      `;
    }).join('');

    const account = getCurrentAccount();
    const initial = initials(account.name);
    el.accountAvatar.textContent = initial;
    el.accountName.textContent = account.name;
    el.accountTopAvatar.textContent = initial;
    if (el.accountSubtitle) el.accountSubtitle.textContent = cloudSubtitle();
  }

  function renderHeader() {
    const timeline = getTimeline();
    if (!timeline) return;
    const color = safeColor(timeline.color);
    el.timelineTitle.textContent = timeline.name;
    el.timelineNote.textContent = timeline.note || '把重要的事，放到看得见的时间里。';
    el.timelineDot.style.background = color;
    el.timelineDot.style.boxShadow = `0 0 0 4px ${color}16`;
    document.documentElement.style.setProperty('--timeline-color', color);
  }

  function renderToolbar() {
    $$('#viewSwitch [data-view]').forEach((button) => {
      const active = button.dataset.view === ui.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const config = VIEWS[ui.view];
    el.rangeLabel.textContent = formatDisplayRange(ui.view, currentPeriods);
    el.rangeSub.textContent = `${config.count} ${config.unit} · 每个节点 1 ${config.unit}`;

    const timeline = getTimeline();
    const doneCount = timeline ? getDoneEvents(timeline).length : 0;
    el.doneCountBadge.textContent = String(doneCount);
  }

  function updateSegmentIndicator() {
    const indicator = $('.segment-indicator', el.viewSwitch);
    const active = $('button.is-active', el.viewSwitch);
    if (!indicator || !active) return;
    const parentRect = el.viewSwitch.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const baseLeft = parseFloat(window.getComputedStyle(indicator).left) || 0;
    indicator.style.width = `${activeRect.width}px`;
    indicator.style.transform = `translateX(${activeRect.left - parentRect.left - baseLeft}px)`;
  }

  function renderBoard(options = {}) {
    const timeline = getTimeline();
    if (!timeline) return;
    const preserveScroll = options.preserveScroll !== false;
    const previousScroll = el.boardScroller.scrollLeft;
    const bodyScrolls = new Map();

    $$('.column-body', el.boardScroller).forEach((body) => {
      bodyScrolls.set(body.dataset.periodKey, body.scrollTop);
    });

    const columns = currentPeriods.map((period) => {
      const periodEvents = timeline.events.filter(
        (event) => !event.done && isInRange(event.date, period.startISO, period.endISO)
      );
      const count = periodEvents.length;

      const zones = timeline.zones.map((zone) => {
        const zoneEvents = sortZoneEvents(periodEvents.filter((event) => event.zoneId === zone.id));
        const expandKey = `${period.key}::${zone.id}`;
        const expanded = Boolean(ui.expanded[expandKey]);
        const visibleEvents = expanded ? zoneEvents : zoneEvents.slice(0, MAX_VISIBLE_EVENTS);
        const hiddenCount = zoneEvents.length - visibleEvents.length;
        const zoneColor = safeColor(zone.color);
        const addButton = `
          <button class="zone-add-row" type="button" data-action="add-event"
            data-zone-id="${esc(zone.id)}" data-date="${esc(period.defaultDate)}"
            data-period-label="${esc(period.title)}" aria-label="在${esc(zone.name)}区域添加事件">
            ${icon('plus')}<span>添加事件</span>
          </button>
        `;

        return `
          <section class="zone" data-drop="zone" data-zone-id="${esc(zone.id)}"
            data-period-key="${esc(period.key)}" style="--zone-color:${zoneColor}"
            aria-label="${esc(zone.name)}区域，${zoneEvents.length} 项">
            <header class="zone-head">
              <span class="zone-dot" aria-hidden="true"></span>
              <h4 class="zone-name">${esc(zone.name)}</h4>
              <span class="zone-count">${zoneEvents.length}</span>
              <button class="zone-add" type="button" data-action="add-event"
                data-zone-id="${esc(zone.id)}" data-date="${esc(period.defaultDate)}"
                data-period-label="${esc(period.title)}" aria-label="在${esc(zone.name)}区域添加事件"
                title="添加事件">${icon('plus')}</button>
            </header>
            <div class="zone-events">
              ${zoneEvents.length === 0 ? `
                <div class="zone-empty">拖动事件到这里，或点击 + 添加</div>
              ` : visibleEvents.map((event) => eventCardHTML(event, zone)).join('')}
              ${zoneEvents.length > MAX_VISIBLE_EVENTS ? `
                <button class="zone-more" type="button" data-action="expand" data-key="${esc(expandKey)}">
                  ${expanded ? '收起' : `还有 ${hiddenCount} 项`}
                </button>
              ` : ''}
              ${addButton}
            </div>
          </section>
        `;
      }).join('');

      const currentLabel = ui.view === 'day'
        ? '今天'
        : ui.view === 'week'
          ? '本周'
          : ui.view === 'month'
            ? '本月'
            : '今年';

      return `
        <article class="timeline-column${period.isCurrent ? ' is-current' : ''}${period.isPast ? ' is-past' : ''}"
          data-period-key="${esc(period.key)}" aria-label="${esc(period.title)}，${count} 项待办">
          <header class="column-head">
            <div class="column-eyebrow-row">
              <span class="column-eyebrow">${esc(period.eyebrow)}</span>
              ${period.isCurrent ? `<span class="today-pill">${currentLabel}</span>` : ''}
            </div>
            <div class="column-title-row">
              <h3 class="column-title">${esc(period.title)}</h3>
              <span class="column-count${count === 0 ? ' is-empty' : ''}">${count ? `${count} 项` : '暂无'}</span>
            </div>
            <p class="column-subline">${esc(period.subline)}</p>
          </header>
          <div class="column-body" data-period-key="${esc(period.key)}">
            ${zones}
          </div>
        </article>
      `;
    }).join('');

    el.boardScroller.className = `board-scroller view-${ui.view}`;
    el.boardScroller.innerHTML = columns;
    el.boardEmpty.hidden = true;

    const previousBehavior = el.boardScroller.style.scrollBehavior;
    el.boardScroller.style.scrollBehavior = 'auto';
    el.boardScroller.scrollLeft = preserveScroll ? previousScroll : 0;
    el.boardScroller.style.scrollBehavior = previousBehavior;

    bodyScrolls.forEach((scrollTop, periodKey) => {
      const body = $$('.column-body', el.boardScroller).find((candidate) => candidate.dataset.periodKey === periodKey);
      if (body) body.scrollTop = scrollTop;
    });
  }

  function eventCardHTML(event, zone) {
    const zoneColor = safeColor(zone.color);
    const priority = PRIORITIES.includes(event.priority) ? event.priority : 'normal';
    const showDate = ui.view !== 'day';
    const metaParts = [];

    if (showDate) {
      metaParts.push(`<span class="event-date">${icon('calendar')}${formatMonthDay(event.date)}</span>`);
    }
    if (priority === 'high') {
      metaParts.push('<span class="priority-chip">优先</span>');
    } else if (priority === 'low') {
      metaParts.push('<span class="priority-chip low">不急</span>');
    }

    return `
      <article class="event-card" data-event-id="${esc(event.id)}" data-zone-id="${esc(zone.id)}"
        data-source="board" data-priority="${priority}" tabindex="0"
        style="--zone-color:${zoneColor}"
        aria-label="${esc(event.title)}，点击编辑，可拖入完成栏"
        title="点击编辑 · 拖动调整">
        <div class="event-title">${esc(event.title)}</div>
        ${event.note ? `<div class="event-note">${esc(event.note)}</div>` : ''}
        ${metaParts.length ? `<div class="event-meta">${metaParts.join('')}</div>` : ''}
        <button class="event-check" type="button" data-action="complete"
          aria-label="完成「${esc(event.title)}」" title="标记完成">${icon('check')}</button>
      </article>
    `;
  }

  function renderDone() {
    const timeline = getTimeline();
    if (!timeline) return;
    const doneEvents = getDoneEvents(timeline);
    const today = todayISO();
    const todayEvents = timeline.events.filter((event) => event.date === today);
    const todayDoneCount = todayEvents.filter((event) => event.done).length;
    const todayPendingCount = todayEvents.filter((event) => !event.done).length;
    const todayTotal = todayDoneCount + todayPendingCount;
    const percent = todayTotal ? Math.round((todayDoneCount / todayTotal) * 100) : 0;

    el.progressLabel.textContent = todayTotal ? `今日完成 ${todayDoneCount} / ${todayTotal}` : '今天还没有安排';
    el.progressPercent.textContent = `${percent}%`;
    el.progressFill.style.width = `${percent}%`;
    el.progressBar.setAttribute('aria-valuenow', String(percent));
    el.doneTotalLabel.textContent = `已完成 ${doneEvents.length} 项`;
    el.pendingTodayLabel.textContent = `今日待办 ${todayPendingCount} 项`;
    el.doneCountBadge.textContent = String(doneEvents.length);
    el.clearDoneBtn.disabled = doneEvents.length === 0;

    if (!doneEvents.length) {
      el.doneList.innerHTML = `
        <div class="done-empty">
          <div class="done-empty-mark" aria-hidden="true">${icon('check')}</div>
          <h4>完成栏还是空的</h4>
          <p>把已完成的事件拖到这里，或者点击卡片右上角的圆圈。它会安静地留在这里。</p>
        </div>
      `;
      return;
    }

    el.doneList.innerHTML = doneEvents.map((event) => {
      const zone = timeline.zones.find((item) => item.id === event.zoneId) || { name: '未分类' };
      return `
        <article class="done-card" data-event-id="${esc(event.id)}" data-source="done" tabindex="0"
          aria-label="${esc(event.title)}，已完成，可拖回时间轴" title="点击查看 · 拖回时间轴可撤销完成">
          <span class="done-check" aria-hidden="true">${icon('check')}</span>
          <div class="done-card-copy">
            <div class="done-title">${esc(event.title)}</div>
            <div class="done-meta">${esc(zone.name)} · ${formatMonthDay(event.date)} · ${completionLabel(event.completedAt)} 完成</div>
          </div>
          <button class="done-undo" type="button" data-action="undo"
            aria-label="撤销完成「${esc(event.title)}」" title="撤销完成">${icon('undo')}</button>
        </article>
      `;
    }).join('');
  }

  /* =========================================================
     Toasts & confirmation
     ========================================================= */

  function showToast(message, options = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'toast-icon';
    iconWrap.innerHTML = icon(options.icon || 'check');

    const messageElement = document.createElement('span');
    messageElement.className = 'toast-message';
    messageElement.textContent = message;

    toast.append(iconWrap, messageElement);

    if (options.action && typeof options.action.onClick === 'function') {
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.className = 'toast-action';
      actionButton.textContent = options.action.label || '撤销';
      actionButton.addEventListener('click', () => {
        dismissToast(toast);
        options.action.onClick();
      });
      toast.appendChild(actionButton);
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'toast-close';
    closeButton.setAttribute('aria-label', '关闭提示');
    closeButton.innerHTML = icon('close');
    closeButton.addEventListener('click', () => dismissToast(toast));
    toast.appendChild(closeButton);

    el.toastStack.appendChild(toast);
    while (el.toastStack.children.length > 3) {
      el.toastStack.firstElementChild.remove();
    }

    const timeout = window.setTimeout(() => dismissToast(toast), options.duration || 4400);
    toast.addEventListener('mouseenter', () => window.clearTimeout(timeout), { once: true });
    return toast;
  }

  function dismissToast(toast) {
    if (!toast || toast.dataset.leaving === '1') return;
    toast.dataset.leaving = '1';
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 210);
  }

  function clearToasts() {
    if (el.toastStack) el.toastStack.replaceChildren();
  }

  let confirmResolver = null;
  let confirmReturnFocus = null;

  function confirmDialog(options = {}) {
    if (confirmResolver) {
      const previous = confirmResolver;
      confirmResolver = null;
      previous(false);
    }
    confirmReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.confirmTitle.textContent = options.title || '确认操作';
    el.confirmMessage.textContent = options.message || '此操作无法撤销。';
    el.confirmOk.textContent = options.confirmText || '确认';
    el.confirmOk.className = `btn ${options.danger === false ? 'btn-primary' : 'btn-danger'}`;
    el.confirmModal.hidden = false;
    window.setTimeout(() => el.confirmCancel.focus(), 30);

    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function settleConfirm(value) {
    if (el.confirmModal.hidden) return;
    el.confirmModal.hidden = true;
    const resolver = confirmResolver;
    confirmResolver = null;
    if (confirmReturnFocus && document.contains(confirmReturnFocus)) {
      confirmReturnFocus.focus({ preventScroll: true });
    }
    confirmReturnFocus = null;
    if (resolver) resolver(value);
  }

  /* =========================================================
     Main modal
     ========================================================= */

  let modalReturnFocus = null;

  function openModal(options = {}) {
    if (el.modal.hidden) {
      modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    el.modalTitle.textContent = options.title || '';
    el.modalKicker.textContent = options.kicker || '时序';
    el.modalBody.innerHTML = options.body || '';
    el.modalFoot.innerHTML = options.footer || '';
    el.modalFoot.hidden = !options.footer;
    el.modalDialog.classList.toggle('modal-wide', Boolean(options.wide));
    el.modalDialog.classList.toggle('modal-slim', Boolean(options.slim));
    el.modal.hidden = false;
    el.modalBody.scrollTop = 0;

    if (typeof options.onMount === 'function') options.onMount();

    requestAnimationFrame(() => {
      const focusTarget = el.modalBody.querySelector('[data-autofocus]')
        || el.modalBody.querySelector('input, textarea, select, button')
        || el.modalDialog;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
      }
    });
  }

  function closeModal() {
    if (el.modal.hidden) return;
    el.modal.hidden = true;
    el.modalBody.innerHTML = '';
    el.modalFoot.innerHTML = '';
    if (modalReturnFocus && document.contains(modalReturnFocus)) {
      modalReturnFocus.focus({ preventScroll: true });
    }
    modalReturnFocus = null;
    if (cloud.token && cloud.tracking && document.visibilityState === 'visible') {
      window.setTimeout(() => {
        if (cloud.token && !cloud.busy && !cloud.dirty) cloudPullCheck();
      }, 500);
    }
  }

  /* =========================================================
     Event operations
     ========================================================= */

  function findEventById(eventId) {
    const timeline = getTimeline();
    if (!timeline) return null;
    return timeline.events.find((event) => event.id === eventId) || null;
  }

  function isDateVisible(date) {
    return currentPeriods.some((period) => isInRange(date, period.startISO, period.endISO));
  }

  function completeEvent(eventId, options = {}) {
    const event = findEventById(eventId);
    if (!event || event.done) return;
    event.done = true;
    event.completedAt = new Date().toISOString();
    event.updatedAt = event.completedAt;
    saveWorkspace();
    renderAll();
    if (!options.silent) {
      showToast(`「${event.title}」已移入完成栏`, {
        icon: 'check',
        action: {
          label: '撤销',
          onClick: () => undoComplete(eventId)
        }
      });
    }
  }

  function undoComplete(eventId) {
    const event = findEventById(eventId);
    if (!event || !event.done) return;
    event.done = false;
    event.completedAt = null;
    event.updatedAt = new Date().toISOString();
    saveWorkspace();
    renderAll();
    showToast('已撤销完成，事件回到时间轴。', { icon: 'undo' });
  }

  function restoreEventSnapshot(eventId, snapshot) {
    const event = findEventById(eventId);
    if (!event) return;
    Object.assign(event, snapshot);
    event.updatedAt = new Date().toISOString();
    saveWorkspace();
    renderAll();
    showToast('已恢复事件原来的位置。', { icon: 'undo' });
  }

  function moveEventToZone(eventId, zoneId, date) {
    const timeline = getTimeline();
    if (!timeline) return;
    const event = timeline.events.find((item) => item.id === eventId);
    const zone = timeline.zones.find((item) => item.id === zoneId);
    if (!event || !zone) return;

    const snapshot = {
      zoneId: event.zoneId,
      date: event.date,
      done: event.done,
      completedAt: event.completedAt
    };

    if (event.zoneId === zone.id && event.date === date && !event.done) return;

    event.zoneId = zone.id;
    event.date = date;
    event.done = false;
    event.completedAt = null;
    event.updatedAt = new Date().toISOString();
    saveWorkspace();
    renderAll();

    const message = snapshot.done
      ? `已撤销完成，放回「${zone.name}」`
      : `已移动到「${zone.name}」`;
    showToast(message, {
      icon: 'move',
      action: {
        label: '撤销',
        onClick: () => restoreEventSnapshot(eventId, snapshot)
      }
    });
  }

  function resolveDropDate(period, originalDate) {
    if (!period) return todayISO();
    if (ui.view === 'day') return period.startISO;

    const original = parseISO(originalDate);

    if (ui.view === 'week') {
      return addDays(period.startISO, clamp(weekdayIndex(originalDate), 0, 6));
    }

    if (ui.view === 'month') {
      const start = parseISO(period.startISO);
      const lastDay = parseISO(period.endISO).getDate();
      return toISO(new Date(start.getFullYear(), start.getMonth(), Math.min(original.getDate(), lastDay), 12));
    }

    if (ui.view === 'year') {
      const start = parseISO(period.startISO);
      const month = original.getMonth();
      const lastDay = new Date(start.getFullYear(), month + 1, 0, 12).getDate();
      return toISO(new Date(start.getFullYear(), month, Math.min(original.getDate(), lastDay), 12));
    }

    return period.defaultDate;
  }

  /* =========================================================
     Event modal
     ========================================================= */

  function openEventModal(options = {}) {
    const timeline = getTimeline();
    if (!timeline) return;

    const editing = Boolean(options.eventId);
    const existing = editing ? timeline.events.find((event) => event.id === options.eventId) : null;
    if (editing && !existing) return;

    const context = options.context || {};
    const defaultZone = timeline.zones.find((zone) => zone.id === context.zoneId)
      || timeline.zones.find((zone) => zone.id === existing?.zoneId)
      || timeline.zones[0];
    const selectedZoneId = existing?.zoneId || defaultZone.id;
    const selectedDate = existing?.date || (isValidISODate(context.date) ? context.date : (currentPeriods[0]?.defaultDate || todayISO()));
    let selectedPriority = existing?.priority || 'normal';

    const zoneOptions = timeline.zones.map((zone) =>
      `<option value="${esc(zone.id)}" ${zone.id === selectedZoneId ? 'selected' : ''}>${esc(zone.name)}</option>`
    ).join('');

    const priorityOptions = PRIORITIES.map((priority) => `
      <button class="priority-option${priority === selectedPriority ? ' is-active' : ''}" type="button"
        data-priority="${priority}" aria-pressed="${priority === selectedPriority ? 'true' : 'false'}">
        <span class="priority-dot" aria-hidden="true"></span>${PRIORITY_LABELS[priority]}
      </button>
    `).join('');

    const footer = `
      ${editing ? `<button class="btn btn-ghost danger-zone" id="deleteEventBtn" type="button">${icon('trash')}删除事件</button>` : ''}
      <button class="btn btn-ghost" type="button" data-modal-close>取消</button>
      <button class="btn btn-primary" type="submit" form="eventForm">${editing ? '保存修改' : '添加事件'}</button>
    `;

    const body = `
      <form id="eventForm" novalidate>
        <div class="field">
          <label class="field-label" for="eventTitle"><span>事件名称</span><em>必填</em></label>
          <input id="eventTitle" data-autofocus type="text" maxlength="80" autocomplete="off"
            value="${esc(existing?.title || '')}" placeholder="想完成什么？">
          <p class="field-error" id="eventError"></p>
        </div>
        <div class="field">
          <label class="field-label" for="eventNote"><span>备注</span><em>可选</em></label>
          <textarea id="eventNote" maxlength="400" rows="3" placeholder="补充一些细节，让未来的自己看得懂。">${esc(existing?.note || '')}</textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="eventDate"><span>日期</span><em>落在哪个节点</em></label>
            <input id="eventDate" type="date" value="${esc(selectedDate)}" required>
          </div>
          <div class="field">
            <label class="field-label" for="eventZone"><span>区域</span><em>可自定义</em></label>
            <select id="eventZone">${zoneOptions}</select>
          </div>
        </div>
        <div class="field">
          <span class="field-label"><span>优先级</span><em>仅作视觉提醒</em></span>
          <div class="priority-picker" id="priorityPicker">${priorityOptions}</div>
        </div>
        <div class="modal-context" id="eventContext"></div>
      </form>
    `;

    openModal({
      title: editing ? '编辑事件' : '新建事件',
      kicker: editing ? 'EDIT EVENT' : 'NEW EVENT',
      body,
      footer,
      onMount: () => {
        const form = $('#eventForm');
        const titleInput = $('#eventTitle');
        const noteInput = $('#eventNote');
        const dateInput = $('#eventDate');
        const zoneSelect = $('#eventZone');
        const errorElement = $('#eventError');
        const contextElement = $('#eventContext');
        const deleteButton = $('#deleteEventBtn');

        const updateContext = () => {
          const zone = timeline.zones.find((item) => item.id === zoneSelect.value) || timeline.zones[0];
          const date = isValidISODate(dateInput.value) ? dateInput.value : selectedDate;
          const doneHint = existing?.done ? ' · 已完成事件' : '';
          contextElement.innerHTML = `${icon('spark')}<span>保存到 <strong>${esc(zone.name)}</strong> 区域 · ${formatMonthDay(date)}${doneHint}</span>`;
        };

        $$('.priority-option', form).forEach((button) => {
          button.addEventListener('click', () => {
            selectedPriority = button.dataset.priority;
            $$('.priority-option', form).forEach((item) => {
              const active = item === button;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
          });
        });

        dateInput.addEventListener('change', updateContext);
        zoneSelect.addEventListener('change', updateContext);
        updateContext();

        form.addEventListener('submit', (event) => {
          event.preventDefault();
          errorElement.textContent = '';
          const title = titleInput.value.trim();
          const date = dateInput.value;
          const zoneId = zoneSelect.value;

          if (!title) {
            errorElement.textContent = '给这件事一个名字吧。';
            titleInput.focus();
            return;
          }
          if (!isValidISODate(date)) {
            errorElement.textContent = '请选择一个有效的日期。';
            dateInput.focus();
            return;
          }
          if (!timeline.zones.some((zone) => zone.id === zoneId)) {
            errorElement.textContent = '这个区域已经不存在了，请重新选择。';
            return;
          }

          const now = new Date().toISOString();
          let savedEvent;
          if (editing) {
            const target = timeline.events.find((item) => item.id === existing.id);
            if (!target) {
              closeModal();
              renderAll();
              showToast('这个事件已经不存在了。', { icon: 'flag' });
              return;
            }
            target.title = title;
            target.note = noteInput.value.trim();
            target.date = date;
            target.zoneId = zoneId;
            target.priority = selectedPriority;
            target.updatedAt = now;
            savedEvent = target;
          } else {
            savedEvent = {
              id: uid('e'),
              title,
              note: noteInput.value.trim(),
              date,
              zoneId,
              priority: selectedPriority,
              done: false,
              completedAt: null,
              createdAt: now,
              updatedAt: now
            };
            timeline.events.push(savedEvent);
          }

          saveWorkspace();
          closeModal();
          renderAll();

          const action = isDateVisible(date) ? undefined : {
            label: '去看看',
            onClick: () => {
              ui.anchor = date;
              persistUi();
              renderAll({ preserveBoardScroll: false });
            }
          };

          showToast(editing ? `已保存「${title}」` : `已添加「${title}」`, {
            icon: 'check',
            action
          });
        });

        if (deleteButton) {
          let armed = false;
          let resetTimer = null;
          const resetDeleteButton = () => {
            armed = false;
            window.clearTimeout(resetTimer);
            deleteButton.innerHTML = `${icon('trash')}删除事件`;
          };
          deleteButton.addEventListener('click', () => {
            if (!armed) {
              armed = true;
              deleteButton.textContent = '再次点击确认删除';
              resetTimer = window.setTimeout(resetDeleteButton, 4200);
              return;
            }
            const index = timeline.events.findIndex((item) => item.id === existing.id);
            if (index < 0) {
              closeModal();
              return;
            }
            const [removed] = timeline.events.splice(index, 1);
            saveWorkspace();
            closeModal();
            renderAll();
            showToast('事件已删除。', {
              icon: 'trash',
              action: {
                label: '撤销',
                onClick: () => {
                  const targetTimeline = state.timelines.find((item) => item.id === timeline.id);
                  if (!targetTimeline) return;
                  targetTimeline.events.splice(index, 0, removed);
                  saveWorkspace();
                  renderAll();
                  showToast('事件已恢复。', { icon: 'undo' });
                }
              }
            });
          });
        }
      }
    });
  }

  /* =========================================================
     Timeline modal
     ========================================================= */

  function openTimelineModal(options = {}) {
    const isNew = options.mode === 'new';
    const timeline = getTimeline();
    if (!isNew && !timeline) return;

    let selectedColor = isNew ? PALETTE[state.timelines.length % PALETTE.length] : safeColor(timeline.color);

    const colorSwatches = PALETTE.map((color) => `
      <button class="color-swatch${color === selectedColor ? ' is-active' : ''}" type="button"
        data-color="${color}" style="--swatch:${color}" aria-label="选择颜色 ${color}"
        aria-pressed="${color === selectedColor ? 'true' : 'false'}"></button>
    `).join('');

    const footer = `
      ${!isNew ? `<button class="btn btn-ghost danger-zone" id="deleteTimelineBtn" type="button">${icon('trash')}删除时间轴</button>` : ''}
      <button class="btn btn-ghost" type="button" data-modal-close>取消</button>
      <button class="btn btn-primary" type="submit" form="timelineForm">${isNew ? '创建时间轴' : '保存修改'}</button>
    `;

    const body = `
      <form id="timelineForm" novalidate>
        <div class="field">
          <label class="field-label" for="timelineName"><span>时间轴名称</span><em>必填</em></label>
          <input id="timelineName" data-autofocus type="text" maxlength="32" autocomplete="off"
            value="${esc(isNew ? '' : timeline.name)}" placeholder="例如：我的时序">
          <p class="field-error" id="timelineError"></p>
        </div>
        <div class="field">
          <label class="field-label" for="timelineNoteInput"><span>一句话说明</span><em>可选</em></label>
          <input id="timelineNoteInput" type="text" maxlength="80" autocomplete="off"
            value="${esc(isNew ? '' : timeline.note)}" placeholder="这条时间轴，想用来安放什么？">
        </div>
        <div class="field">
          <span class="field-label"><span>标记颜色</span><em>用于侧边栏识别</em></span>
          <div class="color-picker" id="timelineColorPicker">${colorSwatches}</div>
        </div>
        ${isNew ? `
          <label class="checkbox-row">
            <input type="checkbox" id="copyZones" checked>
            沿用当前时间轴的区域设置
          </label>
        ` : `
          <p class="field-note">这条时间轴目前有 ${timeline.zones.length} 个区域、${timeline.events.filter((event) => !event.done).length} 项待办。</p>
        `}
      </form>
    `;

    openModal({
      title: isNew ? '新建时间轴' : '编辑时间轴',
      kicker: 'TIMELINE',
      body,
      footer,
      onMount: () => {
        const form = $('#timelineForm');
        const nameInput = $('#timelineName');
        const noteInput = $('#timelineNoteInput');
        const errorElement = $('#timelineError');

        $$('.color-swatch', form).forEach((swatch) => {
          swatch.addEventListener('click', () => {
            selectedColor = swatch.dataset.color;
            $$('.color-swatch', form).forEach((item) => {
              const active = item === swatch;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
          });
        });

        form.addEventListener('submit', (event) => {
          event.preventDefault();
          errorElement.textContent = '';
          const name = nameInput.value.trim();
          if (!name) {
            errorElement.textContent = '给这条时间轴起个名字吧。';
            nameInput.focus();
            return;
          }

          if (isNew) {
            const copyZones = $('#copyZones').checked;
            const zones = copyZones
              ? timeline.zones.map((zone) => ({ id: uid('z'), name: zone.name, color: zone.color }))
              : makeDefaultZones();
            const newTimeline = {
              id: uid('tl'),
              name,
              note: noteInput.value.trim(),
              color: selectedColor,
              zones,
              events: [],
              updatedAt: new Date().toISOString()
            };
            state.timelines.push(newTimeline);
            state.activeTimelineId = newTimeline.id;
            ui.anchor = todayISO();
            persistUi();
            saveWorkspace();
            closeModal();
            closeSidebar();
            renderAll({ preserveBoardScroll: false });
            showToast(`已创建「${name}」`, { icon: 'spark' });
            return;
          }

          const target = state.timelines.find((item) => item.id === timeline.id);
          if (!target) {
            closeModal();
            return;
          }
          target.name = name;
          target.note = noteInput.value.trim();
          target.color = selectedColor;
          target.updatedAt = new Date().toISOString();
          saveWorkspace();
          closeModal();
          renderAll();
          showToast('时间轴设置已更新。', { icon: 'check' });
        });

        const deleteButton = $('#deleteTimelineBtn');
        if (deleteButton) {
          deleteButton.addEventListener('click', async () => {
            if (state.timelines.length <= 1) {
              showToast('至少要保留一条时间轴。', { icon: 'flag' });
              return;
            }
            const eventCount = timeline.events.length;
            const confirmed = await confirmDialog({
              title: '删除这条时间轴？',
              message: `「${timeline.name}」中的 ${eventCount} 个事件也会一并删除。你可以立刻撤销这次操作。`,
              confirmText: '删除时间轴'
            });
            if (!confirmed) return;

            const index = state.timelines.findIndex((item) => item.id === timeline.id);
            if (index < 0) return;
            const [removed] = state.timelines.splice(index, 1);
            if (state.activeTimelineId === removed.id) {
              state.activeTimelineId = state.timelines[Math.min(index, state.timelines.length - 1)].id;
            }
            saveWorkspace();
            closeModal();
            renderAll({ preserveBoardScroll: false });
            showToast('时间轴已删除。', {
              icon: 'trash',
              action: {
                label: '撤销',
                onClick: () => {
                  state.timelines.splice(Math.min(index, state.timelines.length), 0, removed);
                  state.activeTimelineId = removed.id;
                  saveWorkspace();
                  renderAll({ preserveBoardScroll: false });
                  showToast('时间轴已恢复。', { icon: 'undo' });
                }
              }
            });
          });
        }
      }
    });
  }

  /* =========================================================
     Zone settings
     ========================================================= */

  function openZonesModal() {
    const timeline = getTimeline();
    if (!timeline) return;

    let draftZones = timeline.zones.map((zone) => ({ ...zone }));

    const body = `
      <p class="form-tip" style="text-align:left;margin-bottom:14px;">
        这些区域会出现在每一个时间节点下。改名会立即同步到所有事件，最多可以保留 ${MAX_ZONES} 个区域。
      </p>
      <div class="zone-editor-list" id="zoneEditorList"></div>
      <div class="zone-editor-foot">
        <button class="add-zone-btn" id="addZoneBtn" type="button">${icon('plus')}添加区域</button>
        <span class="form-tip" id="zoneLimitHint"></span>
      </div>
      <p class="field-error" id="zoneError"></p>
      <div class="modal-context">
        ${icon('spark')}
        <span>删除区域时，其中的事件会自动移动到第一个区域，不会丢失。</span>
      </div>
    `;

    const footer = `
      <button class="btn btn-ghost" type="button" data-modal-close>取消</button>
      <button class="btn btn-primary" id="saveZonesBtn" type="button">保存区域</button>
    `;

    openModal({
      title: '管理区域',
      kicker: 'ZONES',
      body,
      footer,
      onMount: () => {
        const list = $('#zoneEditorList');
        const addButton = $('#addZoneBtn');
        const limitHint = $('#zoneLimitHint');
        const errorElement = $('#zoneError');
        const saveButton = $('#saveZonesBtn');

        const readDraft = () => {
          const rows = $$('.zone-editor-row', list);
          if (rows.length) {
            draftZones = rows.map((row) => ({
              id: row.dataset.zoneId,
              name: row.querySelector('[data-field="name"]').value,
              color: row.querySelector('[data-field="color"]').value
            }));
          }
          return draftZones;
        };

        const updateLimitHint = () => {
          limitHint.textContent = `${draftZones.length} / ${MAX_ZONES}`;
          addButton.disabled = draftZones.length >= MAX_ZONES;
        };

        const renderRows = (focusId = null) => {
          list.innerHTML = draftZones.map((zone, index) => `
            <div class="zone-editor-row" data-zone-id="${esc(zone.id)}">
              <div class="zone-color-wrap">
                <input type="color" data-field="color" value="${safeColor(zone.color)}"
                  aria-label="区域 ${index + 1} 的颜色">
              </div>
              <input class="zone-name-input" type="text" maxlength="10" data-field="name"
                ${index === 0 ? 'data-autofocus' : ''}
                value="${esc(zone.name)}" placeholder="区域名称" aria-label="区域 ${index + 1} 的名称">
              <button class="zone-remove" type="button" data-remove-zone
                aria-label="删除区域 ${esc(zone.name)}" ${draftZones.length <= 1 ? 'disabled' : ''}>
                ${icon('trash')}
              </button>
            </div>
          `).join('');
          updateLimitHint();
          if (focusId) {
            const row = list.querySelector(`[data-zone-id="${CSS.escape(focusId)}"]`);
            const input = row?.querySelector('[data-field="name"]');
            if (input) {
              input.focus();
              input.select();
            }
          }
        };

        list.addEventListener('click', (event) => {
          const removeButton = event.target.closest('[data-remove-zone]');
          if (!removeButton) return;
          readDraft();
          if (draftZones.length <= 1) {
            showToast('至少要保留一个区域。', { icon: 'flag' });
            return;
          }
          const row = removeButton.closest('.zone-editor-row');
          const id = row.dataset.zoneId;
          draftZones = draftZones.filter((zone) => zone.id !== id);
          renderRows();
        });

        addButton.addEventListener('click', () => {
          readDraft();
          if (draftZones.length >= MAX_ZONES) {
            showToast(`最多可以保留 ${MAX_ZONES} 个区域。`, { icon: 'flag' });
            return;
          }
          const newZone = {
            id: uid('z'),
            name: `区域 ${draftZones.length + 1}`,
            color: PALETTE[draftZones.length % PALETTE.length]
          };
          draftZones.push(newZone);
          renderRows(newZone.id);
        });

        saveButton.addEventListener('click', () => {
          errorElement.textContent = '';
          const rows = readDraft().map((zone, index) => ({
            id: zone.id || uid('z'),
            name: normalizeText(zone.name, 10),
            color: safeColor(zone.color, PALETTE[index % PALETTE.length])
          }));

          if (!rows.length) {
            errorElement.textContent = '请至少保留一个区域。';
            return;
          }
          const emptyIndex = rows.findIndex((zone) => !zone.name);
          if (emptyIndex >= 0) {
            errorElement.textContent = '区域名称不能为空。';
            const inputs = $$('.zone-name-input', list);
            if (inputs[emptyIndex]) inputs[emptyIndex].focus();
            return;
          }

          const newIds = new Set(rows.map((zone) => zone.id));
          const fallbackZoneId = rows[0].id;
          let movedCount = 0;
          timeline.events.forEach((event) => {
            if (!newIds.has(event.zoneId)) {
              event.zoneId = fallbackZoneId;
              movedCount += 1;
            }
          });
          timeline.zones = rows;
          timeline.updatedAt = new Date().toISOString();
          saveWorkspace();
          closeModal();
          renderAll();
          showToast(
            movedCount
              ? `区域已更新，${movedCount} 个事件已移到「${rows[0].name}」`
              : '区域设置已更新。',
            { icon: 'check' }
          );
        });

        renderRows();
      }
    });
  }

  /* =========================================================
     Cloud sync
     ========================================================= */

  function emptyCloudState() {
    return {
      token: '',
      username: '',
      serverUrl: '',
      revision: 0,
      dirty: false,
      lastSyncedAt: null,
      autoSync: true,
      status: 'disconnected',
      error: '',
      busy: false,
      tracking: false,
      conflict: null
    };
  }

  function cloudMetaKey(accountId = currentAccountId) {
    return `${CLOUD.metaPrefix}${accountId}`;
  }

  function loadCloudMetaFor(accountId = currentAccountId) {
    const raw = readJSON(cloudMetaKey(accountId), null);
    const meta = emptyCloudState();
    if (!raw || typeof raw !== 'object') return meta;
    meta.serverUrl = normalizeText(raw.serverUrl, 300);
    meta.username = normalizeText(raw.username, 32);
    meta.token = typeof raw.token === 'string' ? raw.token : '';
    meta.revision = Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0;
    meta.dirty = Boolean(raw.dirty);
    meta.lastSyncedAt = typeof raw.lastSyncedAt === 'string' ? raw.lastSyncedAt : null;
    meta.autoSync = raw.autoSync !== false;
    return meta;
  }

  function saveCloudMeta() {
    writeLocal(cloudMetaKey(), JSON.stringify({
      serverUrl: cloud.serverUrl,
      username: cloud.username,
      token: cloud.token,
      revision: cloud.revision,
      dirty: cloud.dirty,
      lastSyncedAt: cloud.lastSyncedAt,
      autoSync: cloud.autoSync
    }));
  }

  function defaultCloudServer() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      const port = location.port;
      if (port && port !== String(CLOUD.defaultPort) && port !== '80' && port !== '443') {
        return `${location.protocol}//${location.hostname}:${CLOUD.defaultPort}`;
      }
      return location.origin;
    }
    return `http://localhost:${CLOUD.defaultPort}`;
  }

  function normalizeCloudServer(value) {
    let raw = String(value || '').trim();
    if (!raw) throw new Error('请填写同步服务器地址');
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `http://${raw}`;
    let url;
    try {
      url = new URL(raw);
    } catch (error) {
      throw new Error('同步服务器地址格式不正确');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('同步服务器地址需要以 http:// 或 https:// 开头');
    }
    return url.origin;
  }

  function cloudServerLabel() {
    if (!cloud.serverUrl) return defaultCloudServer().replace(/^https?:\/\//, '');
    try {
      return new URL(cloud.serverUrl).host;
    } catch (error) {
      return cloud.serverUrl.replace(/^https?:\/\//, '');
    }
  }

  function cloudStatusLabel() {
    return {
      disconnected: '未连接',
      linking: '待确认',
      connecting: '连接中',
      synced: '已同步',
      syncing: '同步中',
      pending: '待同步',
      offline: '离线',
      error: '同步失败',
      conflict: '需要处理',
      auth: '登录过期'
    }[cloud.status] || '未连接';
  }

  function cloudStatusTone() {
    if (cloud.status === 'synced') return 'is-ok';
    if (cloud.status === 'syncing' || cloud.status === 'pending' || cloud.status === 'connecting' || cloud.status === 'linking') return 'is-busy';
    if (cloud.status === 'conflict' || cloud.status === 'error' || cloud.status === 'auth') return 'is-bad';
    if (cloud.status === 'offline') return 'is-warn';
    return 'is-off';
  }

  function cloudSubtitle() {
    if (cloud.status === 'auth') return '云同步 · 登录已过期';
    if (cloud.status === 'linking') return '云同步 · 等待确认';
    if (cloud.token) {
      if (cloud.status === 'synced') return '云同步 · 已连接';
      if (cloud.status === 'syncing') return '云同步 · 同步中';
      if (cloud.status === 'conflict') return '云同步 · 需要处理';
      if (cloud.status === 'offline') return '云同步 · 暂时离线';
      if (cloud.status === 'error') return '云同步 · 同步失败';
      return '云同步 · 待同步';
    }
    return '本地空间 · 同步码迁移';
  }

  function cloudLastSyncText() {
    if (!cloud.lastSyncedAt) return '尚未同步';
    const date = new Date(cloud.lastSyncedAt);
    if (Number.isNaN(date.getTime())) return '尚未同步';
    return `${completionLabel(cloud.lastSyncedAt)} 已同步`;
  }

  function updateSaveStatus() {
    if (!el.storageStatus) return;
    const strong = el.storageStatus.querySelector('strong');
    el.storageStatus.classList.remove('is-error', 'is-warn');

    if (storageBroken) {
      el.storageStatus.classList.add('is-error');
      if (strong) strong.textContent = '保存不可用';
      el.savedTime.textContent = '仅保留在当前页面';
      return;
    }

    if (cloud.status === 'auth') {
      el.storageStatus.classList.add('is-error');
      if (strong) strong.textContent = '云同步登录过期';
      el.savedTime.textContent = '请重新连接';
      return;
    }

    if (cloud.token) {
      if (cloud.status === 'syncing' || cloud.status === 'connecting') {
        if (strong) strong.textContent = cloud.status === 'connecting' ? '正在连接云端' : '云端同步中';
        el.savedTime.textContent = '正在与服务器同步…';
        return;
      }
      if (cloud.status === 'conflict') {
        el.storageStatus.classList.add('is-error');
        if (strong) strong.textContent = '同步需要处理';
        el.savedTime.textContent = '本机与云端都有改动';
        return;
      }
      if (cloud.status === 'offline') {
        el.storageStatus.classList.add('is-warn');
        if (strong) strong.textContent = '云同步暂时离线';
        el.savedTime.textContent = '本机数据已保存';
        return;
      }
      if (cloud.status === 'error') {
        el.storageStatus.classList.add('is-error');
        if (strong) strong.textContent = '云同步失败';
        el.savedTime.textContent = cloud.error || '本机数据已保存';
        return;
      }
      if (cloud.status === 'pending' || cloud.dirty) {
        if (strong) strong.textContent = '等待云端同步';
        el.savedTime.textContent = '本机已保存';
        return;
      }
      if (strong) strong.textContent = '云端自动同步';
      el.savedTime.textContent = cloud.lastSyncedAt ? `${formatClock(cloud.lastSyncedAt)} 已同步` : '已连接';
      return;
    }

    if (strong) strong.textContent = '本地自动保存';
    el.savedTime.textContent = lastSavedAt ? `${formatClock(lastSavedAt)} 已保存` : '准备就绪';
  }

  function updateCloudIndicators() {
    if (el.accountSubtitle) el.accountSubtitle.textContent = cloudSubtitle();
    if (el.accountCard) {
      el.accountCard.dataset.cloud = cloud.token ? cloud.status : 'off';
      el.accountCard.title = cloud.token ? `云同步：${cloudStatusLabel()}` : '打开账号与同步';
    }
    if (el.accountTop) {
      el.accountTop.dataset.cloud = cloud.token ? cloud.status : 'off';
      el.accountTop.title = cloud.token ? `云同步：${cloudStatusLabel()}` : '账号与同步';
    }
    updateSaveStatus();
    patchOpenAccountCloudStatus();
  }

  function patchOpenAccountCloudStatus() {
    if (!el.modal || el.modal.hidden) return;
    const pill = $('#cloudStatusPill');
    if (pill) {
      pill.textContent = cloudStatusLabel();
      pill.className = `cloud-status-pill ${cloudStatusTone()}`;
    }
    const last = $('#cloudLastSyncText');
    if (last) last.textContent = cloudLastSyncText();
    const syncNow = $('#cloudSyncNowBtn');
    if (syncNow) syncNow.disabled = cloud.busy;
    const error = $('#cloudInlineError');
    if (error) {
      error.textContent = cloud.error || '';
      error.hidden = !cloud.error;
    }
    if (cloud.token === '' && $('#cloudConnectedBox')) {
      renderCloudSection();
      return;
    }
    if (cloud.status === 'conflict' && $('#cloudConnectedBox') && !$('#cloudConflictBox')) {
      renderCloudSection();
      return;
    }
    if ((cloud.status === 'error' || cloud.status === 'offline') && $('#cloudConnectedBox') && !$('#cloudInlineError')) {
      renderCloudSection();
    }
  }

  async function cloudRequest(pathname, options = {}) {
    const serverUrl = normalizeCloudServer(options.serverUrl || cloud.serverUrl);
    const token = options.token === undefined ? cloud.token : options.token;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeout || CLOUD.requestTimeout);
    const headers = { Accept: 'application/json' };
    let body;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${serverUrl}${pathname}`, {
        method: options.method || 'GET',
        headers,
        body,
        signal: controller.signal,
        cache: 'no-store'
      });
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('连接同步服务器超时');
      throw new Error('无法连接同步服务器，请检查地址、网络和防火墙');
    } finally {
      window.clearTimeout(timeout);
    }

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = {};
      }
    }
    if (!response.ok) {
      const requestError = new Error(data.error || `同步服务返回错误（${response.status}）`);
      requestError.status = response.status;
      requestError.code = data.code || '';
      requestError.data = data;
      throw requestError;
    }
    return data;
  }

  async function cloudHealth(serverUrl) {
    try {
      const data = await cloudRequest('/api/health', {
        serverUrl,
        token: '',
        timeout: CLOUD.healthTimeout
      });
      return Boolean(data && data.ok && data.app === 'shixu-sync');
    } catch (error) {
      return false;
    }
  }

  function clearCloudTimers() {
    if (cloudPollTimer) {
      window.clearInterval(cloudPollTimer);
      cloudPollTimer = null;
    }
    if (cloudPushTimer) {
      window.clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (cloudRetryTimer) {
      window.clearTimeout(cloudRetryTimer);
      cloudRetryTimer = null;
    }
  }

  function stopCloudRuntime() {
    clearCloudTimers();
    cloudGeneration += 1;
    cloud.busy = false;
    cloud.tracking = false;
    cloudPendingLink = null;
    cloudModalState.busy = false;
  }

  function startCloudPolling() {
    if (cloudPollTimer) window.clearInterval(cloudPollTimer);
    cloudPollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!cloud.token || cloud.busy || cloud.status === 'conflict') return;
      if (cloud.dirty) scheduleCloudPush(150);
      else cloudPullCheck();
    }, CLOUD.pollMs);
  }

  function scheduleCloudPush(delay = CLOUD.pushDelay) {
    if (!cloud.token || !cloud.autoSync || !navigator.onLine || cloud.status === 'conflict' || cloud.status === 'auth') return;
    if (cloudPushTimer) window.clearTimeout(cloudPushTimer);
    cloudPushTimer = window.setTimeout(() => {
      cloudPushTimer = null;
      cloudPush();
    }, delay);
  }

  function scheduleCloudRetry() {
    if (!cloud.token || !navigator.onLine || cloud.status === 'conflict' || cloud.status === 'auth') return;
    if (cloudRetryTimer) window.clearTimeout(cloudRetryTimer);
    cloudRetryTimer = window.setTimeout(() => {
      cloudRetryTimer = null;
      if (!cloud.token || cloud.busy) return;
      if (cloud.dirty) cloudPush();
      else cloudPullCheck();
    }, 9000);
  }

  function setCloudSession({ serverUrl, token, username, revision, dirty, lastSyncedAt }) {
    cloud.serverUrl = normalizeCloudServer(serverUrl);
    cloud.token = token;
    cloud.username = username || cloud.username;
    cloud.revision = Number.isInteger(revision) ? revision : 0;
    cloud.dirty = Boolean(dirty);
    cloud.lastSyncedAt = lastSyncedAt || new Date().toISOString();
    cloud.autoSync = true;
    cloud.status = dirty ? 'pending' : 'synced';
    cloud.error = '';
    cloud.busy = false;
    cloud.tracking = true;
    cloud.conflict = null;
    saveCloudMeta();
    startCloudPolling();
    updateCloudIndicators();
  }

  async function initCloudForAccount() {
    stopCloudRuntime();
    const generation = cloudGeneration;
    cloud = Object.assign(emptyCloudState(), loadCloudMetaFor(currentAccountId));
    if (!cloud.serverUrl) cloud.serverUrl = defaultCloudServer();
    cloud.status = cloud.token ? 'connecting' : 'disconnected';
    cloud.tracking = false;
    updateCloudIndicators();
    if (!cloud.token) return;

    cloud.tracking = true;
    startCloudPolling();
    const healthy = await cloudHealth(cloud.serverUrl);
    if (generation !== cloudGeneration) return;
    if (!healthy) {
      cloud.status = 'offline';
      cloud.error = '无法连接同步服务器';
      updateCloudIndicators();
      return;
    }
    cloud.status = cloud.dirty ? 'pending' : 'synced';
    updateCloudIndicators();
    if (cloud.dirty) {
      await cloudPush();
    } else {
      await cloudPullCheck({ initial: true });
    }
  }

  function handleCloudAuthLost() {
    clearCloudTimers();
    cloud.token = '';
    cloud.busy = false;
    cloud.tracking = false;
    cloud.status = 'auth';
    cloud.error = '登录已过期，请重新连接同步账号';
    saveCloudMeta();
    updateCloudIndicators();
    showToast('云同步登录已过期，本机数据仍然保留。', {
      icon: 'cloud',
      duration: 7000,
      action: {
        label: '重新连接',
        onClick: openAccountModal
      }
    });
  }

  function handleCloudConflict(remoteState, options = {}) {
    if (!remoteState || !remoteState.workspace) return;
    const already = cloud.status === 'conflict';
    cloud.status = 'conflict';
    cloud.error = '';
    cloud.dirty = true;
    cloud.conflict = {
      revision: remoteState.revision,
      updatedAt: remoteState.updatedAt,
      workspace: normalizeWorkspace(remoteState.workspace)
    };
    if (cloudPushTimer) {
      window.clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (cloudRetryTimer) {
      window.clearTimeout(cloudRetryTimer);
      cloudRetryTimer = null;
    }
    saveCloudMeta();
    updateCloudIndicators();
    if (!already && options.notify !== false) {
      showToast('云端和本机都有新的改动，需要选择如何合并。', {
        icon: 'flag',
        duration: 9000,
        action: {
          label: '处理',
          onClick: openCloudConflictModal
        }
      });
    }
  }

  function handleCloudError(error, fallbackMessage) {
    if (error && error.status === 401) {
      handleCloudAuthLost();
      return;
    }
    if (error && error.status === 409 && error.data && error.data.state) {
      handleCloudConflict(error.data.state);
      return;
    }
    cloud.status = navigator.onLine ? 'error' : 'offline';
    cloud.error = (error && error.message) || fallbackMessage || '同步失败';
    updateCloudIndicators();
  }

  async function cloudPush(options = {}) {
    if (!cloud.token || cloud.busy) return false;
    if (cloud.status === 'conflict') {
      if (options.manual) openCloudConflictModal();
      return false;
    }
    if (!cloud.serverUrl) cloud.serverUrl = defaultCloudServer();

    const generation = cloudGeneration;
    cloud.busy = true;
    cloud.status = 'syncing';
    cloud.error = '';
    updateCloudIndicators();
    const snapshot = JSON.stringify(state);

    try {
      const data = await cloudRequest('/api/sync', {
        method: 'PUT',
        body: {
          baseRevision: cloud.revision,
          workspace: state
        }
      });
      if (generation !== cloudGeneration) return false;
      cloud.revision = Number.isInteger(data.revision) ? data.revision : cloud.revision + 1;
      cloud.lastSyncedAt = new Date().toISOString();
      const current = JSON.stringify(state);
      cloud.dirty = current !== snapshot;
      cloud.status = cloud.dirty ? 'pending' : 'synced';
      cloud.error = '';
      saveCloudMeta();
      updateCloudIndicators();
      if (options.manual) {
        showToast(cloud.dirty ? '已上传，另有新改动等待同步。' : '已同步到云端。', { icon: 'cloud' });
      }
      if (cloud.dirty) scheduleCloudPush(400);
      return true;
    } catch (error) {
      if (generation !== cloudGeneration) return false;
      handleCloudError(error, '上传失败');
      if (options.manual && cloud.status !== 'conflict' && cloud.status !== 'auth') {
        showToast(`同步失败：${cloud.error || '请稍后重试'}`, { icon: 'flag' });
      }
      return false;
    } finally {
      if (generation === cloudGeneration) {
        cloud.busy = false;
        updateCloudIndicators();
        if (cloud.dirty && cloud.status !== 'conflict' && cloud.status !== 'auth') scheduleCloudRetry();
      }
    }
  }

  function applyRemoteCloudState(remoteState, options = {}) {
    if (!remoteState || !remoteState.workspace) return false;
    cloudSuppressDirty = true;
    try {
      state = normalizeWorkspace(remoteState.workspace);
      saveWorkspace(true);
    } finally {
      cloudSuppressDirty = false;
    }
    cloud.revision = Number.isInteger(remoteState.revision) ? remoteState.revision : cloud.revision;
    cloud.dirty = false;
    cloud.lastSyncedAt = new Date().toISOString();
    cloud.status = 'synced';
    cloud.error = '';
    cloud.conflict = null;
    saveCloudMeta();
    renderAll({ preserveBoardScroll: true });
    updateCloudIndicators();
    if (options.notify) {
      showToast('已从云端同步最新数据。', { icon: 'cloud' });
    }
    return true;
  }

  async function cloudPullCheck(options = {}) {
    if (!cloud.token || cloud.busy) return false;
    if (cloud.status === 'conflict') {
      if (options.manual) openCloudConflictModal();
      return false;
    }
    if (!options.manual && (!navigator.onLine || !el.modal.hidden || !el.confirmModal.hidden || dragState)) return false;
    if (cloud.dirty) {
      if (options.manual) return cloudPush({ manual: true });
      scheduleCloudPush(150);
      return false;
    }

    const generation = cloudGeneration;
    cloud.busy = true;
    if (options.manual) {
      cloud.status = 'syncing';
      updateCloudIndicators();
    }
    try {
      const data = await cloudRequest('/api/state');
      if (generation !== cloudGeneration) return false;
      if (cloud.dirty) {
        cloud.status = 'pending';
        updateCloudIndicators();
        scheduleCloudPush(150);
        return false;
      }
      if (data.workspace && Number(data.revision) > cloud.revision) {
        const closeAfter = Boolean(options.manual && !el.modal.hidden);
        applyRemoteCloudState(data, {
          notify: Boolean(options.notify || options.initial || (options.manual && !closeAfter))
        });
        if (closeAfter) {
          closeModal();
          showToast('已从云端同步最新数据。', { icon: 'cloud' });
        }
        return true;
      }
      cloud.lastSyncedAt = new Date().toISOString();
      cloud.status = 'synced';
      cloud.error = '';
      saveCloudMeta();
      updateCloudIndicators();
      if (options.manual) showToast('云端已经是最新数据。', { icon: 'check' });
      return true;
    } catch (error) {
      if (generation !== cloudGeneration) return false;
      handleCloudError(error, '拉取失败');
      if (options.manual && cloud.status !== 'conflict' && cloud.status !== 'auth') {
        showToast(`同步失败：${cloud.error || '请稍后重试'}`, { icon: 'flag' });
      }
      return false;
    } finally {
      if (generation === cloudGeneration) {
        cloud.busy = false;
        updateCloudIndicators();
      }
    }
  }

  async function syncCloudNow() {
    if (!cloud.token) {
      openAccountModal();
      return;
    }
    if (cloud.status === 'conflict') {
      openCloudConflictModal();
      return;
    }
    if (cloud.dirty) await cloudPush({ manual: true });
    else await cloudPullCheck({ manual: true });
  }

  async function disconnectCloud() {
    const confirmed = await confirmDialog({
      title: '断开云同步？',
      message: cloud.dirty
        ? '本机还有未上传的改动。断开后本机数据会保留，但这些改动不会再自动同步。'
        : '本机数据会保留，云端数据也不会删除；之后可以重新登录连接。',
      confirmText: '断开连接'
    });
    if (!confirmed) return;
    stopCloudRuntime();
    cloud.token = '';
    cloud.dirty = false;
    cloud.revision = 0;
    cloud.lastSyncedAt = null;
    cloud.status = 'disconnected';
    cloud.error = '';
    cloud.conflict = null;
    cloud.tracking = false;
    saveCloudMeta();
    updateCloudIndicators();
    if (!el.modal.hidden) renderCloudSection();
    showToast('已断开云同步，本机数据仍然保留。', { icon: 'unlink' });
  }

  function eventTimestamp(event) {
    const value = new Date(event.updatedAt || event.completedAt || event.createdAt || 0).getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  function timelineTimestamp(timeline) {
    const value = new Date(timeline.updatedAt || 0).getTime();
    return Number.isNaN(value) ? 0 : value;
  }

  function mergeWorkspaces(localWorkspace, remoteWorkspace) {
    const merged = normalizeWorkspace(deepClone(localWorkspace));
    const remote = normalizeWorkspace(deepClone(remoteWorkspace));

    for (const remoteTimeline of remote.timelines) {
      let localTimeline = merged.timelines.find((timeline) => timeline.id === remoteTimeline.id);
      if (!localTimeline) {
        if (merged.timelines.length < 20) merged.timelines.push(deepClone(remoteTimeline));
        continue;
      }

      const remoteIsNewer = timelineTimestamp(remoteTimeline) > timelineTimestamp(localTimeline);
      if (remoteIsNewer) {
        localTimeline.name = remoteTimeline.name;
        localTimeline.note = remoteTimeline.note;
        localTimeline.color = remoteTimeline.color;
        localTimeline.updatedAt = remoteTimeline.updatedAt;
      }

      for (const remoteZone of remoteTimeline.zones) {
        const localZone = localTimeline.zones.find((zone) => zone.id === remoteZone.id);
        if (localZone) {
          if (remoteIsNewer) {
            localZone.name = remoteZone.name;
            localZone.color = remoteZone.color;
          }
        } else if (localTimeline.zones.length < MAX_ZONES) {
          localTimeline.zones.push({ ...remoteZone });
        }
      }

      const validZoneIds = new Set(localTimeline.zones.map((zone) => zone.id));
      const fallbackZoneId = localTimeline.zones[0].id;
      for (const remoteEvent of remoteTimeline.events) {
        const localEvent = localTimeline.events.find((event) => event.id === remoteEvent.id);
        if (!localEvent) {
          localTimeline.events.push({
            ...remoteEvent,
            zoneId: validZoneIds.has(remoteEvent.zoneId) ? remoteEvent.zoneId : fallbackZoneId
          });
        } else if (eventTimestamp(remoteEvent) > eventTimestamp(localEvent)) {
          Object.assign(localEvent, remoteEvent);
          if (!validZoneIds.has(localEvent.zoneId)) localEvent.zoneId = fallbackZoneId;
        }
      }
    }

    if (!merged.timelines.some((timeline) => timeline.id === merged.activeTimelineId)) {
      merged.activeTimelineId = merged.timelines[0]?.id;
    }
    return normalizeWorkspace(merged);
  }

  function cloudWorkspaceCounts(workspace) {
    const timelines = workspace?.timelines || [];
    return {
      timelines: timelines.length,
      events: timelines.reduce((total, timeline) => total + (timeline.events?.length || 0), 0)
    };
  }

  function openCloudConflictModal() {
    if (!cloud.conflict) {
      showToast('目前没有待处理的同步冲突。', { icon: 'check' });
      return;
    }
    const remote = cloud.conflict;
    const localCounts = cloudWorkspaceCounts(state);
    const remoteCounts = cloudWorkspaceCounts(remote.workspace);
    const body = `
      <div class="cloud-conflict-intro">
        <span class="cloud-conflict-mark">${icon('flag')}</span>
        <div>
          <h4>本机与云端都有新的改动</h4>
          <p>请选择一种处理方式。合并会保留两边不同的时间轴和事件；同一事件以更新时间较新的版本为准。</p>
        </div>
      </div>
      <div class="cloud-compare">
        <div>
          <span>本机</span>
          <strong>${localCounts.timelines} 条时间轴 · ${localCounts.events} 个事件</strong>
        </div>
        <div>
          <span>云端</span>
          <strong>${remoteCounts.timelines} 条时间轴 · ${remoteCounts.events} 个事件</strong>
        </div>
      </div>
      <div class="cloud-resolution-list">
        <button class="cloud-resolution is-recommended" type="button" data-conflict-resolution="merge">
          <span>${icon('spark')}</span>
          <div><strong>合并两边</strong><em>保留双方独有内容，同一条目取较新版本</em></div>
        </button>
        <button class="cloud-resolution" type="button" data-conflict-resolution="cloud">
          <span>${icon('cloud')}</span>
          <div><strong>使用云端覆盖本机</strong><em>放弃本机尚未上传的改动</em></div>
        </button>
        <button class="cloud-resolution" type="button" data-conflict-resolution="local">
          <span>${icon('upload')}</span>
          <div><strong>用本机覆盖云端</strong><em>放弃云端在本机上次同步后的改动</em></div>
        </button>
      </div>
      <p class="field-error" id="conflictError"></p>
    `;

    openModal({
      title: '处理同步冲突',
      kicker: 'SYNC CONFLICT',
      body,
      footer: '<button class="btn btn-ghost" type="button" data-modal-close>稍后处理</button>',
      slim: true,
      onMount: () => {
        const errorElement = $('#conflictError');
        $$('[data-conflict-resolution]').forEach((button) => {
          button.addEventListener('click', async () => {
            if (button.disabled) return;
            $$('[data-conflict-resolution]').forEach((item) => { item.disabled = true; });
            errorElement.textContent = '';
            try {
              await resolveCloudConflict(button.dataset.conflictResolution, remote);
            } catch (error) {
              errorElement.textContent = error.message || '处理失败，请稍后重试。';
              $$('[data-conflict-resolution]').forEach((item) => { item.disabled = false; });
            }
          });
        });
      }
    });
  }

  async function resolveCloudConflict(choice, remote) {
    if (!cloud.conflict) return;
    if (choice === 'cloud') {
      applyRemoteCloudState(remote, { notify: false });
      closeModal();
      showToast('已使用云端数据覆盖本机。', { icon: 'cloud' });
      return;
    }

    if (choice === 'merge') {
      state = mergeWorkspaces(state, remote.workspace);
    }

    cloudSuppressDirty = true;
    try {
      saveWorkspace(true);
    } finally {
      cloudSuppressDirty = false;
    }
    cloud.revision = remote.revision;
    cloud.dirty = true;
    cloud.status = 'pending';
    cloud.error = '';
    cloud.conflict = null;
    saveCloudMeta();
    closeModal();
    renderAll({ preserveBoardScroll: false });
    updateCloudIndicators();
    const ok = await cloudPush({ manual: true });
    if (ok) {
      showToast(choice === 'merge' ? '已合并两边数据并同步。' : '已用本机数据覆盖云端。', { icon: 'cloud' });
    }
  }

  function cloudLinkChoiceHTML() {
    const localCounts = cloudWorkspaceCounts(state);
    const remoteCounts = cloudWorkspaceCounts(cloudPendingLink?.state?.workspace);
    return `
      <div class="cloud-link-choice">
        <div class="cloud-link-title">
          <span>${icon('cloud')}</span>
          <div>
            <strong>云端已有数据</strong>
            <p>这是本机第一次连接该账号，请选择如何合并。之后会自动同步。</p>
          </div>
        </div>
        <div class="cloud-compare">
          <div><span>本机</span><strong>${localCounts.timelines} 条时间轴 · ${localCounts.events} 个事件</strong></div>
          <div><span>云端</span><strong>${remoteCounts.timelines} 条时间轴 · ${remoteCounts.events} 个事件</strong></div>
        </div>
        <div class="cloud-choice-actions">
          <button class="btn btn-primary" type="button" data-cloud-choice="merge" ${cloudModalState.busy ? 'disabled' : ''}>${icon('spark')}合并两边</button>
          <button class="btn btn-ghost" type="button" data-cloud-choice="cloud" ${cloudModalState.busy ? 'disabled' : ''}>使用云端</button>
          <button class="btn btn-ghost" type="button" data-cloud-choice="local" ${cloudModalState.busy ? 'disabled' : ''}>用本机覆盖</button>
        </div>
        <p class="cloud-help">合并会保留两边不同的内容；同一条事件以更新时间较新的版本为准。</p>
        <button class="text-btn" type="button" data-cloud-action="cancel-link">取消连接</button>
      </div>
    `;
  }

  function cloudConnectedHTML() {
    const conflict = cloud.status === 'conflict';
    return `
      <div class="cloud-connected" id="cloudConnectedBox">
        <div class="cloud-account-row">
          <span class="cloud-account-mark">${icon('cloud')}</span>
          <div class="cloud-account-info">
            <strong>${esc(cloud.username || '同步账号')}</strong>
            <span>${esc(cloudServerLabel())}</span>
          </div>
        </div>
        <div class="cloud-live-meta">
          <span>自动同步已开启</span>
          <span id="cloudLastSyncText">${cloudLastSyncText()}</span>
        </div>
        ${cloud.error ? `<p class="cloud-inline-error" id="cloudInlineError">${esc(cloud.error)}</p>` : ''}
        ${conflict ? `
          <div class="cloud-conflict-box" id="cloudConflictBox">
            <span>${icon('flag')}</span>
            <div><strong>需要处理同步冲突</strong><em>本机与云端都有新的改动。</em></div>
            <button class="btn btn-tiny" type="button" data-cloud-action="resolve">处理</button>
          </div>
        ` : ''}
        <div class="cloud-actions">
          <button class="btn btn-ghost" type="button" id="cloudSyncNowBtn" data-cloud-action="sync-now" ${cloud.busy ? 'disabled' : ''}>${icon('refresh')}立即同步</button>
          <button class="btn btn-ghost" type="button" data-cloud-action="disconnect">${icon('unlink')}断开连接</button>
        </div>
        <p class="cloud-help">自动同步已开启。离开页面后本地先保存，下次打开或回到页面时继续同步。</p>
      </div>
    `;
  }

  function cloudDisconnectedHTML() {
    const formVisible = cloudModalState.formOpen;
    const serverUrl = cloud.serverUrl || defaultCloudServer();
    const isFile = location.protocol === 'file:';
    const authExpired = cloud.status === 'auth';
    return `
      <div class="cloud-empty-card">
        <span class="cloud-empty-mark">${icon('cloud')}</span>
        <div>
          <strong>让手机和电脑自动同步</strong>
          <p>在电脑上启动同步服务，手机打开启动窗口显示的局域网地址，两边登录同一个同步账号。</p>
        </div>
      </div>
      ${authExpired ? `<p class="cloud-inline-error">${esc(cloud.error || '登录已过期，请重新连接。')}</p>` : ''}
      ${cloud.error && !authExpired ? `<p class="cloud-inline-error">${esc(cloud.error)}</p>` : ''}
      ${!formVisible ? `<div class="sync-actions">
        <button class="btn btn-primary" type="button" data-cloud-action="open-form" id="cloudConnectBtn">${icon('cloud')}连接云同步</button>
      </div>` : ''}
      ${formVisible ? `
        <form class="cloud-form" id="cloudLinkForm">
          <div class="field">
            <label class="field-label" for="cloudServerInput"><span>同步服务器地址</span><em>电脑启动窗口会显示</em></label>
            <input id="cloudServerInput" type="text" inputmode="url" autocomplete="off" spellcheck="false"
              value="${esc(serverUrl)}" placeholder="http://192.168.1.5:8787">
            <p class="cloud-help">${isFile
              ? '当前是直接打开文件。手机不能使用 localhost，请填写电脑的局域网地址，例如 http://192.168.1.5:8787。'
              : '如果页面就是从同步服务打开的，保持默认地址即可。'}</p>
          </div>
          <div class="cloud-mode-switch" role="tablist" aria-label="登录或创建同步账号">
            <button type="button" class="${cloudModalState.mode === 'login' ? 'is-active' : ''}" data-cloud-mode="login">登录</button>
            <button type="button" class="${cloudModalState.mode === 'register' ? 'is-active' : ''}" data-cloud-mode="register">创建账号</button>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label" for="cloudUsernameInput"><span>同步账号</span><em>3–32 个字符</em></label>
              <input id="cloudUsernameInput" type="text" maxlength="32" autocomplete="username" spellcheck="false"
                value="${esc(cloud.username || '')}" placeholder="例如：lin">
            </div>
            <div class="field">
              <label class="field-label" for="cloudPasswordInput"><span>密码</span><em>至少 6 位</em></label>
              <input id="cloudPasswordInput" type="password" maxlength="128"
                autocomplete="${cloudModalState.mode === 'register' ? 'new-password' : 'current-password'}"
                placeholder="${cloudModalState.mode === 'register' ? '设置一个密码' : '输入密码'}">
            </div>
          </div>
          <p class="field-error" id="cloudFormError"></p>
          <div class="cloud-form-actions">
            <button class="btn btn-ghost" type="button" data-cloud-action="cancel-form">取消</button>
            <button class="btn btn-primary" type="submit" id="cloudSubmitBtn">${cloudModalState.mode === 'register' ? '创建账号并连接' : '登录并连接'}</button>
          </div>
          <p class="cloud-help">密码只发送给你自己的同步服务器，不会上传到第三方。忘记密码无法找回，请妥善保存。</p>
        </form>
      ` : ''}
    `;
  }

  function renderCloudSection() {
    const section = $('#cloudSection');
    if (!section) return;
    let content;
    if (cloudPendingLink) content = cloudLinkChoiceHTML();
    else if (cloud.token) content = cloudConnectedHTML();
    else content = cloudDisconnectedHTML();
    section.innerHTML = `
      <div class="account-section-head">
        <span class="account-section-label">云同步</span>
        <span class="cloud-status-pill ${cloudStatusTone()}" id="cloudStatusPill">${cloudStatusLabel()}</span>
      </div>
      ${content}
    `;
  }

  async function authenticateCloud({ serverUrl, mode, username, password }) {
    const normalizedServer = normalizeCloudServer(serverUrl);
    if (!(await cloudHealth(normalizedServer))) {
      throw new Error('无法连接同步服务器。请确认 start-sync.bat 正在运行，地址和端口填写正确。');
    }
    const body = { username, password };
    if (mode === 'register') body.workspace = state;
    const data = await cloudRequest(mode === 'register' ? '/api/register' : '/api/login', {
      method: 'POST',
      serverUrl: normalizedServer,
      body,
      token: ''
    });
    return { ...data, serverUrl: normalizedServer };
  }

  async function finishCloudConnection(data, options = {}) {
    const currentState = options.state || state;
    setCloudSession({
      serverUrl: data.serverUrl,
      token: data.token,
      username: data.user?.username || data.username || '',
      revision: data.state?.revision || 0,
      dirty: Boolean(options.dirty),
      lastSyncedAt: new Date().toISOString()
    });
    closeModal();
    closeSidebar();
    clearToasts();
    renderAll({ preserveBoardScroll: false });
    const ok = options.dirty ? await cloudPush({ manual: false }) : true;
    if (ok) {
      showToast(options.dirty ? '云同步已连接，本机数据已上传。' : '云同步已连接。', { icon: 'cloud' });
    } else if (cloud.status !== 'conflict') {
      showToast('云同步已连接，但本机数据暂时没有上传成功，稍后会自动重试。', { icon: 'cloud', duration: 6500 });
    }
    return ok;
  }

  async function completeCloudRegistration(data) {
    cloudPendingLink = null;
    cloudModalState.busy = false;
    cloudModalState.formOpen = false;
    setCloudSession({
      serverUrl: data.serverUrl,
      token: data.token,
      username: data.user?.username || data.username || '',
      revision: data.state?.revision || 1,
      dirty: false,
      lastSyncedAt: new Date().toISOString()
    });
    closeModal();
    closeSidebar();
    clearToasts();
    renderAll({ preserveBoardScroll: false });
    showToast(`云同步账号「${cloud.username}」已创建，数据已上传。`, { icon: 'cloud' });
  }

  async function handleCloudLoginResult(data) {
    cloudModalState.busy = false;
    cloudModalState.formOpen = false;
    const remoteState = data.state;
    if (remoteState?.workspace && Number(remoteState.revision) > 0) {
      cloudPendingLink = {
        serverUrl: data.serverUrl,
        token: data.token,
        user: data.user,
        state: remoteState
      };
      cloud.status = 'linking';
      updateCloudIndicators();
      renderCloudSection();
      return;
    }
    await finishCloudConnection(data, { dirty: true });
  }

  async function resolveInitialCloudChoice(choice) {
    if (!cloudPendingLink || cloudModalState.busy) return;
    const pending = cloudPendingLink;
    cloudModalState.busy = true;
    const buttons = $$('[data-cloud-choice]');
    buttons.forEach((button) => { button.disabled = true; });

    try {
      if (choice === 'cloud') {
        setCloudSession({
          serverUrl: pending.serverUrl,
          token: pending.token,
          username: pending.user?.username || '',
          revision: pending.state.revision,
          dirty: false,
          lastSyncedAt: new Date().toISOString()
        });
        cloudSuppressDirty = true;
        try {
          state = normalizeWorkspace(pending.state.workspace);
          saveWorkspace(true);
        } finally {
          cloudSuppressDirty = false;
        }
        closeModal();
        closeSidebar();
        clearToasts();
        renderAll({ preserveBoardScroll: false });
        showToast('已连接云同步，并载入云端数据。', { icon: 'cloud' });
        return;
      }

      if (choice === 'merge') {
        state = mergeWorkspaces(state, pending.state.workspace);
      }

      cloudSuppressDirty = true;
      try {
        saveWorkspace(true);
      } finally {
        cloudSuppressDirty = false;
      }
      setCloudSession({
        serverUrl: pending.serverUrl,
        token: pending.token,
        username: pending.user?.username || '',
        revision: pending.state.revision,
        dirty: true,
        lastSyncedAt: new Date().toISOString()
      });
      closeModal();
      closeSidebar();
      clearToasts();
      renderAll({ preserveBoardScroll: false });
      const ok = await cloudPush({ manual: false });
      if (ok) {
        showToast(choice === 'merge' ? '已合并两边数据并同步。' : '已连接云同步，本机数据已上传。', { icon: 'cloud' });
      } else if (cloud.status !== 'conflict') {
        showToast('云同步已连接，但本机数据暂时没有上传成功，稍后会自动重试。', { icon: 'cloud', duration: 6500 });
      }
    } catch (error) {
      if (cloud.status === 'linking') cloud.status = 'disconnected';
      showToast(error.message || '连接失败，请重试。', { icon: 'flag' });
    } finally {
      cloudModalState.busy = false;
      cloudPendingLink = null;
      updateCloudIndicators();
      if (!el.modal.hidden) renderCloudSection();
    }
  }

  async function handleCloudSectionSubmit(event) {
    const form = event.target.closest('#cloudLinkForm');
    if (!form) return;
    event.preventDefault();
    if (cloudModalState.busy) return;
    const errorElement = $('#cloudFormError');
    const submitButton = $('#cloudSubmitBtn');
    const serverUrl = $('#cloudServerInput').value;
    const username = $('#cloudUsernameInput').value.trim();
    const password = $('#cloudPasswordInput').value;
    errorElement.textContent = '';

    if (!username) {
      errorElement.textContent = '请填写同步账号。';
      $('#cloudUsernameInput').focus();
      return;
    }
    if (password.length < 6) {
      errorElement.textContent = '密码至少需要 6 个字符。';
      $('#cloudPasswordInput').focus();
      return;
    }

    const generation = cloudGeneration;
    cloudModalState.busy = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = '连接中…';
    }

    try {
      const data = await authenticateCloud({
        serverUrl,
        mode: cloudModalState.mode,
        username,
        password
      });
      if (generation !== cloudGeneration) return;
      cloud.username = data.user?.username || username;
      cloud.serverUrl = data.serverUrl;
      if (cloudModalState.mode === 'register') {
        await completeCloudRegistration(data);
      } else {
        await handleCloudLoginResult(data);
      }
    } catch (error) {
      if (generation !== cloudGeneration) return;
      cloudModalState.busy = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = cloudModalState.mode === 'register' ? '创建账号并连接' : '登录并连接';
      }
      if (errorElement) errorElement.textContent = error.message || '连接失败，请稍后重试。';
    }
  }

  function handleCloudSectionClick(event) {
    const modeButton = event.target.closest('[data-cloud-mode]');
    if (modeButton) {
      cloudModalState.mode = modeButton.dataset.cloudMode;
      renderCloudSection();
      return;
    }

    const actionButton = event.target.closest('[data-cloud-action]');
    if (actionButton) {
      const action = actionButton.dataset.cloudAction;
      if (action === 'open-form') {
        cloudModalState.formOpen = true;
        cloudModalState.mode = 'login';
        renderCloudSection();
        requestAnimationFrame(() => {
          const input = $('#cloudUsernameInput');
          if (input) input.focus();
        });
        return;
      }
      if (action === 'cancel-form') {
        cloudModalState.formOpen = false;
        renderCloudSection();
        return;
      }
      if (action === 'sync-now') {
        syncCloudNow();
        return;
      }
      if (action === 'disconnect') {
        disconnectCloud();
        return;
      }
      if (action === 'resolve') {
        openCloudConflictModal();
        return;
      }
      if (action === 'cancel-link') {
        cloudPendingLink = null;
        cloud.status = 'disconnected';
        cloudModalState.busy = false;
        renderCloudSection();
        updateCloudIndicators();
        return;
      }
    }

    const choiceButton = event.target.closest('[data-cloud-choice]');
    if (choiceButton) {
      resolveInitialCloudChoice(choiceButton.dataset.cloudChoice);
    }
  }

  /* =========================================================
     PWA / install & offline
     ========================================================= */

  function isStandaloneApp() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true;
  }

  function isIosDevice() {
    const userAgent = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function pwaSupported() {
    return 'serviceWorker' in navigator
      && window.isSecureContext
      && (location.protocol === 'http:' || location.protocol === 'https:');
  }

  function installMetaText() {
    if (isStandaloneApp()) return '已作为独立应用运行 · 本地数据继续保存在此浏览器';
    if (!pwaSupported()) return '普通在线使用与本地存储不受影响；离线安装需要 HTTPS';
    if (swRegistrationError) return '离线缓存未能启用，但仍可在线使用';
    if (swReady) return '离线缓存已就绪 · 首次加载后断网也能打开';
    return '正在准备离线缓存…';
  }

  function renderInstallSection() {
    const section = $('#installSection');
    if (!section) return;
    const installed = isStandaloneApp();
    const supported = pwaSupported();
    const ios = isIosDevice();
    let tone = 'is-off';
    let label = '未安装';
    let title = '安装到桌面';
    let description = '安装后可以像 App 一样全屏打开；首次加载完成后，断网也能使用本机数据。';
    let action = '';

    if (installed) {
      tone = 'is-ok';
      label = '已安装';
      title = '正在以独立应用运行';
      description = '你正在使用已安装的「时序」。本地数据继续保存在当前浏览器。';
    } else if (!supported) {
      tone = 'is-warn';
      label = '需要 HTTPS';
      title = '当前地址不支持离线安装';
      description = window.isSecureContext
        ? '此浏览器不支持离线应用缓存，但仍可在线使用。'
        : '手机通过 HTTP 局域网地址访问时，浏览器不会启用 Service Worker。普通在线使用不受影响；需要离线安装时，请使用 HTTPS 公网地址或在 localhost 打开。';
      action = `<button class="btn btn-ghost" type="button" data-pwa-action="help">${icon('help')}查看说明</button>`;
    } else if (swRegistrationError) {
      tone = 'is-bad';
      label = '离线不可用';
      title = '浏览器未能启用离线缓存';
      description = '在线使用与本地数据保存不受影响。可以重新加载页面后再试。';
      action = `<button class="btn btn-ghost" type="button" data-pwa-action="help">查看说明</button>`;
    } else {
      tone = swReady ? 'is-ok' : 'is-busy';
      label = swReady ? '可安装' : '准备中';
      title = ios ? '添加到 iPhone 主屏幕' : '安装到桌面';
      description = ios
        ? 'Safari 分享 → 添加到主屏幕。安装后可全屏打开，首次加载完成后也能离线使用。'
        : '安装后可全屏打开；首次加载完成后，断网也能使用本机数据。';
      action = `<button class="btn btn-primary" type="button" data-pwa-action="install">${icon(deferredInstallPrompt ? 'install' : 'share')}${deferredInstallPrompt ? '安装' : '查看安装方法'}</button>`;
    }

    section.innerHTML = `
      <div class="account-section-head">
        <span class="account-section-label">安装与离线</span>
        <span class="cloud-status-pill ${tone}">${label}</span>
      </div>
      <div class="install-card${installed ? ' is-installed' : ''}">
        <span class="install-mark">${icon(installed ? 'check' : supported ? 'install' : 'cloud')}</span>
        <div class="install-copy">
          <strong>${title}</strong>
          <p>${description}</p>
        </div>
        ${action ? `<div class="install-actions">${action}</div>` : ''}
      </div>
      <p class="install-meta">${installMetaText()}</p>
    `;
  }

  function updateInstallSection() {
    renderInstallSection();
  }

  async function promptPwaInstall() {
    if (isStandaloneApp()) {
      showToast('「时序」已经在独立应用模式中运行。', { icon: 'check' });
      return;
    }
    if (!deferredInstallPrompt) {
      openInstallHelp();
      return;
    }
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        showToast('正在安装「时序」…', { icon: 'install' });
      } else {
        showToast('已取消安装。', { icon: 'install' });
      }
    } catch (error) {
      openInstallHelp();
    }
    updateInstallSection();
  }

  function openInstallHelp() {
    const ios = isIosDevice();
    const secure = pwaSupported();
    const steps = ios
      ? [
          '用 Safari 打开当前页面。微信、QQ 等内置浏览器不能安装。',
          '点击浏览器底部工具栏的「分享」按钮。',
          '选择「添加到主屏幕」，确认名称为「时序」后点「添加」。'
        ]
      : [
          '用 Chrome 或 Edge 打开当前页面。',
          '点击地址栏右侧的安装图标，或打开浏览器菜单。',
          '选择「安装应用」或「添加到主屏幕」。'
        ];

    const body = `
      <div class="install-guide">
        <div class="install-guide-mark">${icon(ios ? 'share' : 'install')}</div>
        <h3>${ios ? '添加到 iPhone 主屏幕' : '安装「时序」到桌面'}</h3>
        <p>安装后可以像 App 一样打开；首次加载完成后，即使断网也能查看和编辑本机数据。</p>
        <ol class="install-steps">
          ${steps.map((step) => `<li>${esc(step)}</li>`).join('')}
        </ol>
        ${secure ? '' : `
          <div class="install-warning">
            ${icon('flag')}
            <span>当前离线安装不可用：浏览器只在 HTTPS 或 localhost 下允许 Service Worker。当前 HTTP 局域网地址仍可在线使用，但无法启用离线缓存。</span>
          </div>
        `}
        <div class="modal-context">
          ${icon('spark')}
          <span>数据保存在当前浏览器。换成另一个网址安装后，会是一份独立的本地数据；可以通过云同步或同步码迁移。</span>
        </div>
      </div>
    `;

    openModal({
      title: '安装时序',
      kicker: 'INSTALL',
      body,
      footer: '<button class="btn btn-ghost" type="button" data-modal-close>关闭</button>',
      slim: true
    });
  }

  function handleInstallSectionClick(event) {
    const actionButton = event.target.closest('[data-pwa-action]');
    if (!actionButton) return;
    if (actionButton.dataset.pwaAction === 'install') {
      promptPwaInstall();
    } else if (actionButton.dataset.pwaAction === 'help') {
      openInstallHelp();
    }
  }

  function maybeShowInstallHint(reason) {
    if (isStandaloneApp() || !pwaSupported()) return;
    if (readLocal('shixu.installHint.v1')) return;
    if (reason === 'prompt' && !deferredInstallPrompt) return;
    if (reason === 'ios' && !isIosDevice()) return;
    writeLocal('shixu.installHint.v1', '1');

    const message = reason === 'ios'
      ? 'iPhone 可添加到主屏幕：Safari 分享 → 添加到主屏幕。'
      : '可以把「时序」安装到桌面，离线也能打开。';

    showToast(message, {
      icon: reason === 'ios' ? 'share' : 'install',
      duration: 8000,
      action: {
        label: reason === 'ios' ? '查看' : '安装',
        onClick: () => {
          if (reason === 'ios') openInstallHelp();
          else promptPwaInstall();
        }
      }
    });
  }

  function setupPwa() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateInstallSection();
      if (pwaHintTimer) window.clearTimeout(pwaHintTimer);
      pwaHintTimer = window.setTimeout(() => maybeShowInstallHint('prompt'), 1400);
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (pwaHintTimer) {
        window.clearTimeout(pwaHintTimer);
        pwaHintTimer = null;
      }
      updateInstallSection();
      showToast('「时序」已安装到桌面。', { icon: 'check' });
    });

    if (!pwaSupported()) return;

    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((registration) => {
      // 每次打开都主动检查一次，确保已安装的 PWA 能拿到新的离线缓存版本。
      registration.update().catch(() => {});
      navigator.serviceWorker.ready.then(() => {
        swReady = true;
        updateInstallSection();
      }).catch(() => {
        swRegistrationError = true;
        updateInstallSection();
      });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            swReady = true;
            updateInstallSection();
          }
        });
      });
    }).catch(() => {
      swRegistrationError = true;
      updateInstallSection();
    });

    if (isIosDevice()) {
      window.setTimeout(() => maybeShowInstallHint('ios'), 3200);
    }
  }

  /* =========================================================
     Account & sync
     ========================================================= */

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function decodeBase64Utf8(base64) {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function createSyncCode() {
    saveWorkspace(true);
    const account = getCurrentAccount();
    const payload = {
      app: 'shixu',
      version: 1,
      exportedAt: new Date().toISOString(),
      accountName: account.name,
      workspace: state
    };
    return `SHIXU1.${encodeBase64Utf8(JSON.stringify(payload))}`;
  }

  function parseSyncCode(code) {
    const cleaned = String(code || '').trim().replace(/\s+/g, '');
    if (!cleaned) throw new Error('empty');
    const base64 = cleaned.startsWith('SHIXU1.') ? cleaned.slice(7) : cleaned;
    const json = decodeBase64Utf8(base64);
    const payload = JSON.parse(json);
    const workspace = payload.workspace || payload;
    if (!workspace || !Array.isArray(workspace.timelines) || !workspace.timelines.length) {
      throw new Error('invalid');
    }
    return {
      accountName: normalizeText(payload.accountName, 24) || '未知空间',
      workspace: normalizeWorkspace(workspace)
    };
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the legacy path.
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch (error) {
      return false;
    }
  }

  function switchAccount(accountId) {
    if (accountId === currentAccountId) return;
    stopCloudRuntime();
    saveWorkspace();
    currentAccountId = accountId;
    persistActiveAccount();
    state = loadWorkspaceFor(accountId);
    saveWorkspace();
    closeModal();
    closeSidebar();
    clearToasts();
    renderAll({ preserveBoardScroll: false });
    showToast(`已切换到「${getCurrentAccount().name}」`, { icon: 'user' });
    initCloudForAccount();
  }

  function openAccountModal() {
    cloudModalState = { formOpen: false, mode: 'login', busy: false };
    if (cloudPendingLink) {
      cloudPendingLink = null;
      if (cloud.status === 'linking') cloud.status = 'disconnected';
    }
    const account = getCurrentAccount();
    const allAccounts = [GUEST, ...accounts];
    const accountRows = allAccounts.map((item) => {
      const active = item.id === currentAccountId;
      return `
        <div class="account-row${active ? ' is-current' : ''}">
          <span class="avatar">${esc(initials(item.name))}</span>
          <span class="account-row-copy">
            <strong>${esc(item.name)}</strong>
            <span>${item.guest ? '谁都可以使用，数据留在本机' : '本地账号空间'}</span>
          </span>
          ${active
            ? `<span class="current-tag">${icon('check')}当前</span>`
            : `<button class="btn btn-tiny" type="button" data-switch-account="${esc(item.id)}">切换</button>`}
        </div>
      `;
    }).join('');

    const totalEvents = state.timelines.reduce((total, timeline) => total + timeline.events.length, 0);

    const body = `
      <div class="account-summary">
        <span class="avatar">${esc(initials(account.name))}</span>
        <div class="account-summary-copy">
          <h3>${esc(account.name)} <span class="local-badge">${account.guest ? '访客空间' : '本地账号'}</span></h3>
          <p>${state.timelines.length} 条时间轴 · ${totalEvents} 个事件 · ${cloud.token ? '已开启云同步' : '数据保存在当前浏览器'}</p>
        </div>
      </div>

      <div class="account-section" id="cloudSection"></div>

      <div class="account-section" id="installSection"></div>

      <div class="account-section">
        <div class="account-section-head">
          <span class="account-section-label">本机空间</span>
          <span class="form-tip">切换无需密码</span>
        </div>
        <div class="account-list">${accountRows}</div>
        <form class="inline-form" id="createAccountForm">
          <input type="text" id="newAccountName" maxlength="18" autocomplete="off" placeholder="新账号名称，例如：小林的时序">
          <button class="btn btn-primary" type="submit">新建</button>
          <label class="checkbox-row inline-form-options">
            <input type="checkbox" id="copyCurrentData" checked>
            复制当前空间的数据到新账号
          </label>
          <p class="field-error" id="accountError" style="grid-column:1/-1;"></p>
        </form>
      </div>

      <div class="account-section">
        <div class="account-section-head">
          <span class="account-section-label">手动迁移</span>
          <span class="form-tip">备用方式</span>
        </div>
        <p class="sync-copy">没有云同步时，也可以生成同步码，在另一台设备导入。同步码包含全部时间轴与事件，请当作私密内容保存。</p>
        <div class="sync-actions">
          <button class="btn btn-ghost" type="button" data-sync-action="export">${icon('download')}生成同步码</button>
          <button class="btn btn-ghost" type="button" data-sync-action="import">${icon('upload')}导入同步码</button>
        </div>
        <div class="sync-panel" id="syncPanel" hidden>
          <textarea id="syncText" spellcheck="false" placeholder="粘贴同步码"></textarea>
          <div class="sync-panel-actions">
            <button class="btn btn-ghost" id="syncCopyBtn" type="button" hidden>${icon('copy')}复制</button>
            <button class="btn btn-primary" id="syncApplyBtn" type="button" hidden>确认导入</button>
          </div>
          <p class="sync-footnote" id="syncFootnote"></p>
        </div>
      </div>

      <div class="danger-section">
        <p>清空当前空间后，所有时间轴与事件都会消失。${cloud.token ? '<br><strong>云同步已连接，云端副本也会在同步后被清空。</strong>' : ''}<br>这个操作可以通过提示条撤销，也可以先导出同步码备份。</p>
        <button class="btn-link-danger" id="resetWorkspaceBtn" type="button">清空当前空间</button>
      </div>
    `;

    openModal({
      title: '账号与同步',
      kicker: 'ACCOUNT',
      body,
      footer: '<button class="btn btn-ghost" type="button" data-modal-close>关闭</button>',
      wide: true,
      onMount: () => {
        const accountError = $('#accountError');
        const createForm = $('#createAccountForm');
        const newNameInput = $('#newAccountName');
        const syncPanel = $('#syncPanel');
        const syncText = $('#syncText');
        const syncCopyButton = $('#syncCopyBtn');
        const syncApplyButton = $('#syncApplyBtn');
        const syncFootnote = $('#syncFootnote');
        const cloudSection = $('#cloudSection');
        const installSection = $('#installSection');

        renderCloudSection();
        cloudSection.addEventListener('click', handleCloudSectionClick);
        cloudSection.addEventListener('submit', handleCloudSectionSubmit);
        renderInstallSection();
        installSection.addEventListener('click', handleInstallSectionClick);

        $$('[data-switch-account]').forEach((button) => {
          button.addEventListener('click', () => switchAccount(button.dataset.switchAccount));
        });

        createForm.addEventListener('submit', (event) => {
          event.preventDefault();
          accountError.textContent = '';
          const name = newNameInput.value.trim();
          if (!name) {
            accountError.textContent = '给这个空间起个名字吧。';
            newNameInput.focus();
            return;
          }
          if ([GUEST, ...accounts].some((item) => item.name.toLowerCase() === name.toLowerCase())) {
            accountError.textContent = '这个名称已经存在，请换一个。';
            newNameInput.focus();
            return;
          }

          const copyData = $('#copyCurrentData').checked;
          const newId = uid('acc');
          stopCloudRuntime();
          saveWorkspace();
          accounts.push({ id: newId, name, createdAt: new Date().toISOString() });
          persistAccounts();
          currentAccountId = newId;
          state = copyData ? deepClone(state) : createDefaultWorkspace();
          persistActiveAccount();
          saveWorkspace();
          closeModal();
          closeSidebar();
          clearToasts();
          renderAll({ preserveBoardScroll: false });
          showToast(`已创建本地空间「${name}」`, { icon: 'user' });
          initCloudForAccount();
        });

        $$('[data-sync-action]').forEach((button) => {
          button.addEventListener('click', async () => {
            const action = button.dataset.syncAction;
            syncPanel.hidden = false;
            if (action === 'export') {
              const code = createSyncCode();
              syncText.readOnly = true;
              syncText.value = code;
              syncCopyButton.hidden = false;
              syncApplyButton.hidden = true;
              syncFootnote.textContent = `已包含 ${state.timelines.length} 条时间轴，${state.timelines.reduce((total, timeline) => total + timeline.events.length, 0)} 个事件。`;
              syncText.focus();
              syncText.select();
              return;
            }

            syncText.readOnly = false;
            syncText.value = '';
            syncText.placeholder = '在这里粘贴另一台设备生成的同步码';
            syncCopyButton.hidden = true;
            syncApplyButton.hidden = false;
            syncFootnote.textContent = '导入会覆盖当前空间，请确认已经备份。';
            syncText.focus();
          });
        });

        syncCopyButton.addEventListener('click', async () => {
          if (!syncText.value) return;
          const copied = await copyText(syncText.value);
          if (copied) {
            showToast('同步码已复制到剪贴板。', { icon: 'copy' });
          } else {
            syncText.focus();
            syncText.select();
            showToast('复制失败，请手动全选并复制。', { icon: 'flag' });
          }
        });

        syncApplyButton.addEventListener('click', async () => {
          let parsed;
          try {
            parsed = parseSyncCode(syncText.value);
          } catch (error) {
            showToast('同步码无法识别，请检查是否复制完整。', { icon: 'flag' });
            syncText.focus();
            return;
          }

          const importedEvents = parsed.workspace.timelines.reduce((total, timeline) => total + timeline.events.length, 0);
          const confirmed = await confirmDialog({
            title: '用同步码覆盖当前空间？',
            message: `将导入「${parsed.accountName}」的 ${parsed.workspace.timelines.length} 条时间轴、${importedEvents} 个事件。当前空间的数据会被替换。${cloud.token ? '云同步已连接，导入后会同步覆盖云端副本。' : ''}`,
            confirmText: '覆盖并导入'
          });
          if (!confirmed) return;

          state = parsed.workspace;
          ui.anchor = todayISO();
          persistUi();
          saveWorkspace();
          closeModal();
          closeSidebar();
          clearToasts();
          renderAll({ preserveBoardScroll: false });
          showToast('同步完成，已载入新的时间轴。', { icon: 'spark' });
        });

        $('#resetWorkspaceBtn').addEventListener('click', async () => {
          const confirmed = await confirmDialog({
            title: '清空当前空间？',
            message: `所有时间轴、区域和事件都会被清空。${cloud.token ? '云同步已连接，云端副本也会在同步后被清空。' : ''}操作后可以用提示条撤销，但建议先导出同步码备份。`,
            confirmText: '清空空间'
          });
          if (!confirmed) return;

          const backup = deepClone(state);
          state = createDefaultWorkspace();
          saveWorkspace();
          closeModal();
          closeSidebar();
          clearToasts();
          renderAll({ preserveBoardScroll: false });
          showToast('当前空间已清空。', {
            icon: 'trash',
            duration: 6000,
            action: {
              label: '撤销',
              onClick: () => {
                state = backup;
                saveWorkspace();
                renderAll({ preserveBoardScroll: false });
                showToast('空间已恢复。', { icon: 'undo' });
              }
            }
          });
        });
      }
    });
  }

  /* =========================================================
     Drag & drop
     ========================================================= */

  let pendingDrag = null;
  let dragState = null;
  let dragFrame = null;
  let suppressClickUntil = 0;

  function clearPendingDrag() {
    if (!pendingDrag) return;
    window.clearTimeout(pendingDrag.timer);
    pendingDrag = null;
  }

  function cleanupDrag() {
    clearPendingDrag();
    if (dragFrame) {
      cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    if (dragState) {
      dragState.sourceEl?.classList.remove('is-dragging');
      dragState.target?.classList.remove('drag-over');
      dragState.ghost?.remove();
      dragState = null;
    }
    el.dragGhostLayer.replaceChildren();
    el.dragHint.hidden = true;
    el.dragDoneTarget.hidden = true;
    el.dragDoneTarget.classList.remove('drag-over');
    const hintText = $('span', el.dragHint);
    if (hintText) hintText.textContent = '松手，放入区域或完成栏';
    document.body.classList.remove('is-dragging');
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
  }

  function beginDrag(clientX, clientY) {
    if (!pendingDrag) return;
    const pending = pendingDrag;
    window.clearTimeout(pending.timer);
    const card = pending.card;
    if (!card.isConnected) {
      cleanupDrag();
      return;
    }

    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.classList.remove('is-dragging');
    ghost.removeAttribute('tabindex');
    ghost.removeAttribute('role');
    ghost.setAttribute('aria-hidden', 'true');
    $$('[id]', ghost).forEach((node) => node.removeAttribute('id'));
    ghost.style.width = `${rect.width}px`;
    el.dragGhostLayer.replaceChildren(ghost);

    card.classList.add('is-dragging');
    dragState = {
      sourceEl: card,
      sourceType: card.dataset.source || 'board',
      pointerId: pending.pointerId,
      ghost,
      offsetX: clamp(pending.startX - rect.left, 6, rect.width - 6),
      offsetY: clamp(pending.startY - rect.top, 6, rect.height - 6),
      target: null,
      lastX: clientX,
      lastY: clientY
    };
    pendingDrag = null;

    document.body.classList.add('is-dragging');
    el.dragHint.hidden = false;
    const hintText = $('span', el.dragHint);
    if (hintText) {
      hintText.textContent = dragState.sourceType === 'done'
        ? '松手，放回时间轴区域'
        : '松手，放入区域或完成栏';
    }
    if (window.matchMedia('(max-width: 1180px)').matches) {
      el.dragDoneTarget.hidden = false;
    }

    moveGhost(clientX, clientY);
    updateDropTarget(clientX, clientY);
    dragFrame = requestAnimationFrame(autoScrollWhileDragging);
    try {
      if (navigator.vibrate) navigator.vibrate(9);
    } catch (error) {
      // Vibration is a progressive enhancement.
    }
  }

  function moveGhost(clientX, clientY) {
    if (!dragState || !dragState.ghost) return;
    const x = clientX - dragState.offsetX;
    const y = clientY - dragState.offsetY;
    dragState.ghost.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(-1.2deg) scale(1.015)`;
  }

  function updateDropTarget(clientX, clientY) {
    if (!dragState) return;
    const node = document.elementFromPoint(clientX, clientY);
    let target = node ? node.closest('[data-drop]') : null;
    if (target && dragState.sourceType === 'done' && target.dataset.drop === 'done') {
      target = null;
    }
    if (target && target.dataset.drop === 'zone' && !target.dataset.periodKey) {
      target = null;
    }
    if (target === dragState.target) return;

    dragState.target?.classList.remove('drag-over');
    dragState.target = target;
    if (target) target.classList.add('drag-over');
  }

  function autoScrollWhileDragging() {
    if (!dragState) return;
    const { lastX, lastY } = dragState;
    const boardRect = el.boardScroller.getBoundingClientRect();
    const edge = 66;

    if (lastX < boardRect.left + edge) {
      el.boardScroller.scrollLeft -= Math.ceil((boardRect.left + edge - lastX) / 8);
    } else if (lastX > boardRect.right - edge) {
      el.boardScroller.scrollLeft += Math.ceil((lastX - (boardRect.right - edge)) / 8);
    }

    const columnBody = dragState.target?.closest('.column-body');
    if (columnBody) {
      const bodyRect = columnBody.getBoundingClientRect();
      if (lastY < bodyRect.top + 46) {
        columnBody.scrollTop -= 9;
      } else if (lastY > bodyRect.bottom - 46) {
        columnBody.scrollTop += 9;
      }
    }

    updateDropTarget(lastX, lastY);
    dragFrame = requestAnimationFrame(autoScrollWhileDragging);
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.isPrimary === false) return;
    if (pendingDrag || dragState) return;
    if (!el.modal.hidden || !el.confirmModal.hidden) return;

    const card = event.target.closest('.event-card, .done-card');
    if (!card) return;
    if (event.target.closest('button, a, input, textarea, select')) return;

    const rect = card.getBoundingClientRect();
    pendingDrag = {
      card,
      pointerId: event.pointerId,
      touch: event.pointerType !== 'mouse',
      startX: event.clientX,
      startY: event.clientY,
      timer: null
    };

    if (pendingDrag.touch) {
      pendingDrag.timer = window.setTimeout(() => {
        if (!pendingDrag) return;
        beginDrag(pendingDrag.startX, pendingDrag.startY);
      }, 260);
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  }

  function handlePointerMove(event) {
    if (dragState) {
      if (event.pointerId !== dragState.pointerId) return;
      if (event.cancelable) event.preventDefault();
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      moveGhost(event.clientX, event.clientY);
      updateDropTarget(event.clientX, event.clientY);
      return;
    }

    if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
    const distance = Math.hypot(event.clientX - pendingDrag.startX, event.clientY - pendingDrag.startY);
    if (distance <= 7) return;

    if (pendingDrag.touch) {
      clearPendingDrag();
      return;
    }

    beginDrag(event.clientX, event.clientY);
    if (dragState) {
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      moveGhost(event.clientX, event.clientY);
      updateDropTarget(event.clientX, event.clientY);
    }
  }

  function handlePointerUp(event) {
    if (dragState && event.pointerId === dragState.pointerId) {
      let liveTarget = null;
      try {
        liveTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop]') || null;
      } catch (error) {
        liveTarget = null;
      }
      if (liveTarget && dragState.sourceType === 'done' && liveTarget.dataset.drop === 'done') {
        liveTarget = null;
      }
      const target = liveTarget || dragState.target;
      const eventId = dragState.sourceEl?.dataset.eventId;
      const sourceType = dragState.sourceType;
      const targetDrop = target?.dataset.drop;
      const targetZoneId = target?.dataset.zoneId;
      const targetPeriodKey = target?.dataset.periodKey;

      suppressClickUntil = performance.now() + 420;
      cleanupDrag();

      if (targetDrop === 'done' && sourceType !== 'done' && eventId) {
        completeEvent(eventId);
        return;
      }

      if (targetDrop === 'zone' && targetZoneId && targetPeriodKey && eventId) {
        const period = currentPeriods.find((item) => item.key === targetPeriodKey);
        const source = findEventById(eventId);
        if (period && source) {
          const targetDate = resolveDropDate(period, source.date);
          moveEventToZone(eventId, targetZoneId, targetDate);
        }
      }
      return;
    }

    clearPendingDrag();
    cleanupDrag();
  }

  function handlePointerCancel() {
    suppressClickUntil = performance.now() + 250;
    cleanupDrag();
  }

  /* =========================================================
     Navigation helpers
     ========================================================= */

  function closeSidebar() {
    el.sidebar.classList.remove('is-open');
    el.sidebarScrim.hidden = true;
  }

  function openSidebar() {
    closeDonePanel();
    el.sidebar.classList.add('is-open');
    el.sidebarScrim.hidden = false;
  }

  function closeDonePanel() {
    el.donePanel.classList.remove('is-open');
    el.doneBackdrop.hidden = true;
  }

  function openDonePanel() {
    if (!window.matchMedia('(max-width: 1180px)').matches) return;
    closeSidebar();
    el.donePanel.classList.add('is-open');
    el.doneBackdrop.hidden = false;
  }

  function setView(view) {
    if (!Object.prototype.hasOwnProperty.call(VIEWS, view) || view === ui.view) return;
    ui.view = view;
    ui.expanded = {};
    persistUi();
    renderAll({ preserveBoardScroll: false });
  }

  function shiftRange(direction) {
    const config = VIEWS[ui.view];
    if (ui.view === 'day') {
      ui.anchor = addDays(ui.anchor, config.step * direction);
    } else if (ui.view === 'week') {
      ui.anchor = addDays(ui.anchor, config.step * direction);
    } else if (ui.view === 'month') {
      ui.anchor = addMonthsISO(ui.anchor, config.step * direction);
    } else {
      ui.anchor = addMonthsISO(ui.anchor, config.step * 12 * direction);
    }
    persistUi();
    renderAll({ preserveBoardScroll: false });
  }

  function goToday() {
    ui.anchor = todayISO();
    persistUi();
    renderAll({ preserveBoardScroll: false });
  }

  function defaultEventContext() {
    const timeline = getTimeline();
    if (!timeline) return {};
    const currentPeriod = currentPeriods.find((period) => period.isCurrent);
    const fallbackPeriod = currentPeriod || currentPeriods[0];
    return {
      date: fallbackPeriod?.defaultDate || todayISO(),
      zoneId: timeline.zones[0]?.id,
      periodLabel: fallbackPeriod?.title || ''
    };
  }

  function switchTimeline(timelineId) {
    if (!state || state.activeTimelineId === timelineId) {
      closeSidebar();
      return;
    }
    if (!state.timelines.some((timeline) => timeline.id === timelineId)) return;
    state.activeTimelineId = timelineId;
    saveWorkspace();
    clearToasts();
    renderAll({ preserveBoardScroll: false });
    closeSidebar();
  }

  function isTypingTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function trapFocus(event, container) {
    const focusable = $$(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container
    ).filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (!focusable.length) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  /* =========================================================
     Click & keyboard handlers
     ========================================================= */

  function handleBoardClick(event) {
    if (performance.now() < suppressClickUntil) return;
    const actionElement = event.target.closest('[data-action]');
    if (actionElement) {
      const action = actionElement.dataset.action;
      if (action === 'complete') {
        const card = actionElement.closest('.event-card');
        if (card) completeEvent(card.dataset.eventId);
        return;
      }
      if (action === 'add-event') {
        openEventModal({
          context: {
            date: actionElement.dataset.date,
            zoneId: actionElement.dataset.zoneId,
            periodLabel: actionElement.dataset.periodLabel
          }
        });
        return;
      }
      if (action === 'expand') {
        const key = actionElement.dataset.key;
        if (!key) return;
        ui.expanded[key] = !ui.expanded[key];
        renderBoard();
        return;
      }
      return;
    }

    const card = event.target.closest('.event-card');
    if (card) openEventModal({ eventId: card.dataset.eventId });
  }

  function handleDoneClick(event) {
    if (performance.now() < suppressClickUntil) return;
    const undoButton = event.target.closest('[data-action="undo"]');
    if (undoButton) {
      const card = undoButton.closest('.done-card');
      if (card) undoComplete(card.dataset.eventId);
      return;
    }
    const card = event.target.closest('.done-card');
    if (card) openEventModal({ eventId: card.dataset.eventId });
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      if (!el.confirmModal.hidden) {
        event.preventDefault();
        settleConfirm(false);
        return;
      }
      if (!el.modal.hidden) {
        event.preventDefault();
        closeModal();
        return;
      }
      if (dragState) {
        event.preventDefault();
        suppressClickUntil = performance.now() + 250;
        cleanupDrag();
        return;
      }
      if (el.donePanel.classList.contains('is-open')) {
        closeDonePanel();
        return;
      }
      if (el.sidebar.classList.contains('is-open')) {
        closeSidebar();
        return;
      }
    }

    if (event.key === 'Tab') {
      if (!el.confirmModal.hidden) {
        trapFocus(event, $('.confirm-dialog', el.confirmModal));
        return;
      }
      if (!el.modal.hidden) {
        trapFocus(event, el.modalDialog);
        return;
      }
    }

    if (!el.confirmModal.hidden || !el.modal.hidden || dragState) return;

    if ((event.key === 'Enter' || event.key === ' ') && !isTypingTarget(event.target)) {
      const card = event.target.closest('.event-card, .done-card');
      if (card && !event.target.closest('button')) {
        event.preventDefault();
        openEventModal({ eventId: card.dataset.eventId });
        return;
      }
    }

    if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openEventModal({ context: defaultEventContext() });
    } else if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      goToday();
    }
  }

  /* =========================================================
     Bind events
     ========================================================= */

  function bindStaticEvents() {
    document.addEventListener('click', (event) => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    el.viewSwitch.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-view]');
      if (button) setView(button.dataset.view);
    });

    el.prevRange.addEventListener('click', () => shiftRange(-1));
    el.nextRange.addEventListener('click', () => shiftRange(1));
    el.todayBtn.addEventListener('click', goToday);

    el.menuBtn.addEventListener('click', openSidebar);
    el.sidebarClose.addEventListener('click', closeSidebar);
    el.sidebarScrim.addEventListener('click', closeSidebar);

    el.accountCard.addEventListener('click', openAccountModal);
    el.accountTop.addEventListener('click', openAccountModal);
    el.editTimelineBtn.addEventListener('click', () => openTimelineModal());
    el.manageZonesBtn.addEventListener('click', openZonesModal);
    el.newTimelineBtn.addEventListener('click', () => openTimelineModal({ mode: 'new' }));
    el.newTimelineBtn2.addEventListener('click', () => openTimelineModal({ mode: 'new' }));

    el.addEventBtn.addEventListener('click', () => openEventModal({ context: defaultEventContext() }));
    el.emptyAddBtn.addEventListener('click', () => openEventModal({ context: defaultEventContext() }));

    el.doneToggle.addEventListener('click', () => {
      if (el.donePanel.classList.contains('is-open')) {
        closeDonePanel();
      } else {
        openDonePanel();
      }
    });
    el.doneClose.addEventListener('click', closeDonePanel);
    el.doneBackdrop.addEventListener('click', closeDonePanel);

    el.timelineList.addEventListener('click', (event) => {
      const item = event.target.closest('[data-timeline-id]');
      if (item) switchTimeline(item.dataset.timelineId);
    });

    el.boardScroller.addEventListener('click', handleBoardClick);
    el.doneList.addEventListener('click', handleDoneClick);

    el.modalClose.addEventListener('click', closeModal);
    el.modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-modal-close]')) closeModal();
    });

    el.confirmOk.addEventListener('click', () => settleConfirm(true));
    el.confirmCancel.addEventListener('click', () => settleConfirm(false));
    el.confirmModal.addEventListener('click', (event) => {
      if (event.target.closest('[data-confirm-close]')) settleConfirm(false);
    });

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('touchmove', (event) => {
      if (dragState) event.preventDefault();
    }, { passive: false });
    document.addEventListener('contextmenu', (event) => {
      if (event.target.closest('.event-card, .done-card')) event.preventDefault();
    });

    el.donePanel.dataset.drop = 'done';

    el.clearDoneBtn.addEventListener('click', async () => {
      const timeline = getTimeline();
      if (!timeline) return;
      const doneEvents = getDoneEvents(timeline);
      if (!doneEvents.length) return;

      const confirmed = await confirmDialog({
        title: '清空已完成事件？',
        message: `完成栏里的 ${doneEvents.length} 项事件会被移除。操作后可以立刻撤销。`,
        confirmText: '清空完成栏'
      });
      if (!confirmed) return;

      timeline.events = timeline.events.filter((event) => !event.done);
      saveWorkspace();
      renderAll();
      showToast(`已清空 ${doneEvents.length} 项已完成事件。`, {
        icon: 'trash',
        action: {
          label: '撤销',
          onClick: () => {
            const targetTimeline = state.timelines.find((item) => item.id === timeline.id);
            if (!targetTimeline) return;
            targetTimeline.events.push(...doneEvents);
            saveWorkspace();
            renderAll();
            showToast('完成栏已恢复。', { icon: 'undo' });
          }
        }
      });
    });

    let resizeFrame = null;
    window.addEventListener('resize', () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        updateSegmentIndicator();
        if (window.innerWidth > 1180) closeDonePanel();
        if (window.innerWidth > 980) closeSidebar();
      });
    });

    window.addEventListener('beforeunload', () => saveWorkspace(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveWorkspace(true);
        if (cloud.token && cloud.dirty) cloudPush();
      } else if (cloud.token) {
        cloudPullCheck();
      }
    });
    window.addEventListener('focus', () => {
      if (cloud.token && document.visibilityState === 'visible') cloudPullCheck();
    });
    window.addEventListener('online', () => {
      if (cloud.token) {
        if (cloud.dirty) cloudPush();
        else cloudPullCheck();
      }
    });
  }

  /* =========================================================
     Boot
     ========================================================= */

  function init() {
    accounts = loadAccounts();
    const storedActive = readLocal(STORAGE.activeAccount, 'guest');
    currentAccountId = storedActive === 'guest' || accounts.some((account) => account.id === storedActive)
      ? storedActive
      : 'guest';
    state = loadWorkspaceFor(currentAccountId);
    ui = loadUi();

    bindStaticEvents();
    setupPwa();
    renderAll({ preserveBoardScroll: false });
    saveWorkspace(true);
    persistActiveAccount();
    initCloudForAccount();

    if (storageBroken) showStorageWarning();

    let knownToday = todayISO();
    window.setInterval(() => {
      const current = todayISO();
      if (current !== knownToday) {
        knownToday = current;
        renderAll();
      }
    }, 60000);
  }

  init();

})();
