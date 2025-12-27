// ==================== 全局状态管理 ====================
const AppState = {
  token: localStorage.getItem('authToken') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  currentLang: localStorage.getItem('preferredLang') || 'en',
  trips: [],
  fallbackRates: { USD: 1 },
};

// ==================== 翻译 ====================
const translations = {
  en: {
    pageTitle: "Travel Helper",
    sidebarTitle: "Macao",
    tagline: "Plan your journey!!!",
    navMyTrips: "My Trips",
    navCreateTrip: "Create Trip",
    navConverter: "Currency Converter",
    mainTitle: "Travel Helper",
    subtitle: "Trip list + Simple currency converter",
    tripListTitle: "Trip List",
    createTripTitle: "Create a New Trip",
    editTripTitle: "Edit Trip",
    labelTitle: "Title",
    labelLocation: "Location",
    labelPrice: "Price (USD)",
    labelDescription: "Description",
    createButton: "Create Trip",
    updateButton: "Update Trip",
    editButton: "Edit",
    cancelButton: "Cancel",
    convertButton: "Convert",
    noTrips: "No trips yet. Create one!",
    signOut: "Sign Out",
    footer: "© 2025 Travel Helper",
    loginTitle: "Sign In",
    registerTitle: "Sign Up",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    signInButton: "Sign In",
    signUpButton: "Create Account",
    switchToRegister: "Don't have an account?",
    switchToLogin: "Already have an account?",
    loading: "Loading...",
    deleteConfirm: "Are you sure you want to delete this trip?",
    success: "Success!",
    error: "Error occurred",
  },
  zh: {
    pageTitle: "旅行助手",
    sidebarTitle: "澳门",
    tagline: "规划你的旅程!!!",
    navMyTrips: "我的行程",
    navCreateTrip: "创建行程",
    navConverter: "货币转换器",
    mainTitle: "旅行助手",
    subtitle: "行程列表 + 简易货币转换器",
    tripListTitle: "行程列表",
    createTripTitle: "创建新行程",
    editTripTitle: "编辑行程",
    labelTitle: "标题",
    labelLocation: "目的地",
    labelPrice: "价格 (美元)",
    labelDescription: "描述",
    createButton: "创建行程",
    updateButton: "更新行程",
    editButton: "编辑",
    cancelButton: "取消",
    convertButton: "转换",
    noTrips: "暂无行程,快去创建吧!",
    signOut: "退出登录",
    footer: "© 2025 旅行助手",
    loginTitle: "登录",
    registerTitle: "注册",
    emailPlaceholder: "邮箱",
    passwordPlaceholder: "密码",
    signInButton: "登录",
    signUpButton: "创建账户",
    switchToRegister: "没有账户?",
    switchToLogin: "已有账户?",
    loading: "加载中...",
    deleteConfirm: "确定要删除这个行程吗?",
    success: "成功!",
    error: "发生错误",
  }
};

// ==================== 工具函数 ====================
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function setText(sel, text) {
  const el = $(sel);
  if (el) el.textContent = text;
}

function t(key) {
  return translations[AppState.currentLang][key] || key;
}

// API 请求封装
async function apiRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (AppState.token) {
    headers['Authorization'] = `Bearer ${AppState.token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    showNotification(error.message, 'error');
    throw error;
  }
}

// 通知系统
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ==================== 认证管理 ====================
function setAuth(token, user) {
  AppState.token = token;
  AppState.user = user;
  localStorage.setItem('authToken', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  AppState.token = null;
  AppState.user = null;
  AppState.trips = [];
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
}

function isAuthenticated() {
  return !!AppState.token;
}

// ==================== UI 管理 ====================
function applyLanguage() {
  document.title = t('pageTitle');
  setText('.sidebar h2', t('sidebarTitle'));
  setText('.sidebar .tagline', t('tagline'));
  setText('.sidebar nav a[data-target="trips-section"]', t('navMyTrips'));
  setText('.sidebar nav a[data-target="create-section"]', t('navCreateTrip'));
  setText('.sidebar nav a[data-target="converter-section"]', t('navConverter'));
  setText('header h1', t('mainTitle'));
  setText('header p', t('subtitle'));
  setText('#trips-section h2', t('tripListTitle'));
  setText('#create-section h2', t('createTripTitle'));
  setText('label[for="title"]', t('labelTitle'));
  setText('label[for="location"]', t('labelLocation'));
  setText('label[for="price"]', t('labelPrice'));
  setText('label[for="description"]', t('labelDescription'));
  
  const createBtn = $('#create-trip-form button[type="submit"]');
  if (createBtn) createBtn.textContent = t('createButton');
  
  setText('#convert', t('convertButton'));
  setText('.logout', t('signOut'));
  setText('footer small', t('footer'));

  // 更新行程列表空状态
  const tripsEl = $('#trips');
  if (tripsEl && AppState.trips.length === 0) {
    tripsEl.innerHTML = `<p class="empty-state">${t('noTrips')}</p>`;
  }
}

function setLanguage(lang) {
  AppState.currentLang = lang;
  localStorage.setItem('preferredLang', lang);
  applyLanguage();
  renderTrips(); // 重新渲染以更新按钮文本
}

function showPage(id) {
  $$('.page-view').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  
  const target = $(`#${id}`);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }
  
  $$('.sidebar nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.target === id);
  });

  // 关闭移动端菜单
  closeMobileMenu();
}

function closeMobileMenu() {
  const hamburger = $('#hamburger');
  const sidebar = $('#sidebar');
  const backdrop = $('#backdrop');
  
  if (hamburger) hamburger.classList.remove('active');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

// ==================== 行程管理 ====================
let editingTripId = null;

async function loadTrips() {
  try {
    const trips = await apiRequest('/api/trips');
    AppState.trips = trips;
    renderTrips();
  } catch (error) {
    $('#trips').innerHTML = `<p class="error-state">${t('error')}</p>`;
  }
}

function renderTrips() {
  const container = $('#trips');
  if (!container) return;

  if (AppState.trips.length === 0) {
    container.innerHTML = `<p class="empty-state">${t('noTrips')}</p>`;
    return;
  }

  container.innerHTML = '';
  AppState.trips.forEach(trip => {
    container.appendChild(createTripElement(trip));
  });
}

function createTripElement(trip) {
  const div = document.createElement('div');
  div.className = 'trip';
  
  const title = document.createElement('h3');
  title.textContent = trip.title;
  
  const location = document.createElement('p');
  location.className = 'trip-location';
  location.textContent = `📍 ${trip.location}`;
  
  const price = document.createElement('p');
  price.className = 'trip-price';
  price.textContent = `💰 $${Number(trip.price).toFixed(2)}`;
  
  const desc = document.createElement('p');
  desc.className = 'trip-description';
  desc.textContent = trip.description || '';

  const actions = document.createElement('div');
  actions.className = 'trip-actions';

  // 编辑按钮
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit';
  editBtn.textContent = t('editButton');
  editBtn.onclick = (e) => {
    e.stopPropagation();
    startEditTrip(trip);
  };

  // 删除按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.textContent = '🗑️';
  deleteBtn.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm(t('deleteConfirm'))) return;

    try {
      await apiRequest(`/api/trip/${trip.id}`, { method: 'DELETE' });
      AppState.trips = AppState.trips.filter(t => t.id !== trip.id);
      renderTrips();
      showNotification('Trip deleted', 'success');
    } catch (error) {
      // Error already shown by apiRequest
    }
  };

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  div.appendChild(title);
  div.appendChild(location);
  div.appendChild(price);
  if (trip.description) div.appendChild(desc);
  div.appendChild(actions);

  // 点击卡片查看详情
  div.onclick = () => {
    window.location.href = `trip.html?id=${trip.id}`;
  };

  return div;
}

function startEditTrip(trip) {
  editingTripId = trip.id;
  
  $('#title').value = trip.title;
  $('#location').value = trip.location;
  $('#price').value = trip.price;
  $('#description').value = trip.description || '';

  const form = $('#create-trip-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.textContent = t('updateButton');

  // 添加取消按钮
  let cancelBtn = $('#cancel-edit-btn');
  if (!cancelBtn) {
    cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-edit-btn';
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = t('cancelButton');
    cancelBtn.onclick = cancelEdit;
    submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
  }

  setText('#create-section h2', t('editTripTitle'));
  showPage('create-section');
}

function cancelEdit() {
  editingTripId = null;
  $('#create-trip-form').reset();
  
  const submitBtn = $('#create-trip-form button[type="submit"]');
  submitBtn.textContent = t('createButton');
  
  const cancelBtn = $('#cancel-edit-btn');
  if (cancelBtn) cancelBtn.remove();
  
  setText('#create-section h2', t('createTripTitle'));
  showPage('trips-section');
}

async function handleTripSubmit(e) {
  e.preventDefault();

  const data = {
    title: $('#title').value.trim(),
    location: $('#location').value.trim(),
    price: parseFloat($('#price').value),
    description: $('#description').value.trim()
  };

  try {
    if (editingTripId) {
      // 更新
      const updated = await apiRequest(`/api/trip/${editingTripId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });

      const index = AppState.trips.findIndex(t => t.id === editingTripId);
      if (index !== -1) {
        AppState.trips[index] = updated;
      }
      
      showNotification('Trip updated successfully!', 'success');
      cancelEdit();
    } else {
      // 创建
      const newTrip = await apiRequest('/api/trip', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      AppState.trips.unshift(newTrip);
      showNotification('Trip created successfully!', 'success');
      e.target.reset();
    }

    renderTrips();
    showPage('trips-section');
  } catch (error) {
    // Error already shown by apiRequest
  }
}

// ==================== 货币转换器 (已修改: 仅限 USD, EUR, CNY) ====================
async function initConverter() {
  try {
    const resp = await fetch('/api/latest?base=USD');
    const data = await resp.json();
    
    if (!data || !data.rates) throw new Error('Invalid rates data');

    // === 修改开始: 定义允许的货币并过滤 ===
    const allowedCurrencies = ['USD', 'EUR', 'CNY'];
    
    // 从 API 返回的列表中过滤，只保留允许的货币
    // 即使 API 没有返回 USD (如果是基准货币)，我们也确保它在列表里
    const currencies = allowedCurrencies.sort(); 

    const fromSelect = $('#from-currency');
    const toSelect = $('#to-currency');

    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    currencies.forEach(code => {
      fromSelect.add(new Option(code, code));
      toSelect.add(new Option(code, code));
    });

    // 设置默认值
    fromSelect.value = 'USD';
    toSelect.value = 'CNY'; // 默认为人民币
    // === 修改结束 ===

    $('#convert').onclick = () => {
      const amount = parseFloat($('#amount').value) || 0;
      const from = fromSelect.value;
      const to = toSelect.value;

      const fromRate = data.rates[from] || 1;
      const toRate = data.rates[to] || 1;
      const result = (amount / fromRate * toRate).toFixed(4).replace(/\.?0+$/, '');

      $('#converted').textContent = `${amount} ${from} = ${result} ${to}`;
      drawRateChart(from, to);
    };

    // 初始图表
    drawRateChart('USD', 'CNY');
  } catch (error) {
    console.warn('Live rates failed, using fallback');
    // Fallback logic...
  }
}

async function drawRateChart(base, target) {
  const canvas = $('#rate-chart');
  if (!canvas) return;

  const titleEl = $('#chart-title');
  if (titleEl) titleEl.textContent = `${base} → ${target} (30 days)`;

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const fmt = d => d.toISOString().slice(0, 10);

  try {
    const url = `/api/timeseries?start_date=${fmt(start)}&end_date=${fmt(end)}&base=${base}&symbols=${target}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (!data || !data.rates) throw new Error('Invalid timeseries data');

    const labels = [];
    const values = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      const rate = data.rates[key]?.[target];
      values.push(rate || null);
    }

    if (typeof Chart === 'undefined') {
      await loadChartJs();
    }

    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    canvas._chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `${base}/${target}`,
          data: values,
          borderColor: '#0077cc',
          backgroundColor: 'rgba(0,119,204,0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  } catch (error) {
    console.error('Chart error:', error);
  }
}

function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (typeof Chart !== 'undefined') return resolve();
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ==================== 认证界面 ====================
async function handleLogin(e) {
  e.preventDefault();

  const email = $('#email').value.trim();
  const password = $('#password').value;

  try {
    const data = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    setAuth(data.token, data.user);
    showMainApp();
    showNotification('Login successful!', 'success');
  } catch (error) {
    $('#login-result').textContent = error.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();

  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;

  try {
    await apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    $('#register-result').textContent = 'Account created! Please sign in.';
    $('#register-result').style.color = '#27ae60';
    
    setTimeout(() => {
      $('#register-section').style.display = 'none';
      $('#login-section').style.display = 'block';
    }, 1500);
  } catch (error) {
    $('#register-result').textContent = error.message;
    $('#register-result').style.color = '#e74c3c';
  }
}

function showMainApp() {
  $('#auth-container').style.display = 'none';
  $('#main-app').style.display = 'flex';
  $('#user-email').textContent = AppState.user?.email || 'User';
  
  applyLanguage();
  loadTrips();
  initConverter();
  showPage('trips-section');
}

function showAuthScreen() {
  $('#auth-container').style.display = 'block';
  $('#main-app').style.display = 'none';
  applyLanguage();
}

function handleLogout() {
  clearAuth();
  showAuthScreen();
  showNotification('Logged out successfully', 'info');
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  // 应用语言
  applyLanguage();

  // 检查认证状态
  if (isAuthenticated()) {
    showMainApp();
  } else {
    showAuthScreen();
  }

  // 语言切换
  $$('.language-switcher button').forEach(btn => {
    btn.onclick = () => {
      const lang = btn.textContent.includes('EN') ? 'en' : 'zh';
      setLanguage(lang);
    };
  });

  // 认证表单
  $('#login-form').onsubmit = handleLogin;
  $('#register-form').onsubmit = handleRegister;

  $('#show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#login-section').style.display = 'none';
    $('#register-section').style.display = 'block';
  });

  $('#show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    $('#register-section').style.display = 'none';
    $('#login-section').style.display = 'block';
  });

  // 行程表单
  $('#create-trip-form').onsubmit = handleTripSubmit;

  // 登出
  $('.logout')?.addEventListener('click', handleLogout);

  // 导航
  $$('.sidebar nav a[data-target]').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      showPage(link.dataset.target);
    };
  });

  // 汉堡菜单
  const hamburger = $('#hamburger');
  const sidebar = $('#sidebar');
  const backdrop = $('#backdrop');

  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
  });

  backdrop?.addEventListener('click', closeMobileMenu);

  $('.content')?.addEventListener('click', (e) => {
    if (!e.target.closest('.language-switcher') && sidebar?.classList.contains('open')) {
      closeMobileMenu();
    }
  });
});