const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/shell' });

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file serving
app.use('/static', express.static(path.join(__dirname, '.')));
app.use(express.static(path.join(__dirname, '.')));

// ---------------------------------------------------------------------------
// In-Memory Data Store
// ---------------------------------------------------------------------------
const startTime = Date.now();

let bots = [
  {
    botID: 'BOT-SG-7102',
    ip: '103.21.244.18',
    country: 'SG',
    processName: 'kworker/u8:2 [PID 1420]',
    arch: 'x86_64',
    ram: 4096,
    cpuCores: 8,
    caps: ['A', 'S', 'N', 'C', 'R'],
    lastSeen: '1秒前',
    attacksEnabled: true,
    socksEnabled: true,
    snifferEnabled: true,
    scannerEnabled: true,
    rootkitEnabled: true,
    socksActive: true,
    socksRelay: '103.21.244.18:1080'
  },
  {
    botID: 'BOT-US-3319',
    ip: '198.51.100.89',
    country: 'US',
    processName: 'systemd-journald-aux [PID 2801]',
    arch: 'x86_64',
    ram: 8192,
    cpuCores: 8,
    caps: ['A', 'S', 'C', 'R'],
    lastSeen: '刚刚',
    attacksEnabled: true,
    socksEnabled: true,
    snifferEnabled: false,
    scannerEnabled: true,
    rootkitEnabled: true,
    socksActive: true,
    socksRelay: '198.51.100.89:1080'
  },
  {
    botID: 'BOT-ES-9104',
    ip: '88.198.42.112',
    country: 'ES',
    processName: 'dbus-daemon-worker [PID 892]',
    arch: 'arm64',
    ram: 2048,
    cpuCores: 4,
    caps: ['A', 'C'],
    lastSeen: '3秒前',
    attacksEnabled: true,
    socksEnabled: false,
    snifferEnabled: false,
    scannerEnabled: true,
    rootkitEnabled: false,
    socksActive: false,
    socksRelay: ''
  },
  {
    botID: 'BOT-JP-4028',
    ip: '133.242.18.50',
    country: 'JP',
    processName: 'syslog-ng-priv [PID 3409]',
    arch: 'x86_64',
    ram: 4096,
    cpuCores: 4,
    caps: ['A', 'S', 'N', 'C'],
    lastSeen: '刚刚',
    attacksEnabled: true,
    socksEnabled: true,
    snifferEnabled: true,
    scannerEnabled: true,
    rootkitEnabled: false,
    socksActive: false,
    socksRelay: ''
  },
  {
    botID: 'BOT-DE-1823',
    ip: '144.76.101.44',
    country: 'DE',
    processName: 'cron-scheduler-d [PID 5510]',
    arch: 'x86_64',
    ram: 16384,
    cpuCores: 16,
    caps: ['A', 'S', 'N', 'C', 'R'],
    lastSeen: '2秒前',
    attacksEnabled: true,
    socksEnabled: true,
    snifferEnabled: true,
    scannerEnabled: true,
    rootkitEnabled: true,
    socksActive: true,
    socksRelay: '144.76.101.44:1080'
  },
  {
    botID: 'BOT-NL-6601',
    ip: '185.107.56.20',
    country: 'NL',
    processName: 'nginx-worker [PID 1102]',
    arch: 'x86_64',
    ram: 8192,
    cpuCores: 8,
    caps: ['A', 'S', 'C'],
    lastSeen: '刚刚',
    attacksEnabled: true,
    socksEnabled: true,
    snifferEnabled: false,
    scannerEnabled: true,
    rootkitEnabled: false,
    socksActive: false,
    socksRelay: ''
  },
  {
    botID: 'BOT-AU-5192',
    ip: '139.130.4.5',
    country: 'AU',
    processName: 'rpcbind-svc [PID 774]',
    arch: 'mips',
    ram: 512,
    cpuCores: 2,
    caps: ['A', 'C'],
    lastSeen: '5秒前',
    attacksEnabled: true,
    socksEnabled: false,
    snifferEnabled: false,
    scannerEnabled: true,
    rootkitEnabled: false,
    socksActive: false,
    socksRelay: ''
  }
];

let activityLog = [
  { timestamp: new Date(Date.now() - 360000).toLocaleTimeString(), type: 'CONNECT', message: '节点 BOT-SG-7102 握手成功 (103.21.244.18:41892)' },
  { timestamp: new Date(Date.now() - 280000).toLocaleTimeString(), type: 'PROXY', message: 'SOCKS5 代理服务已在 BOT-SG-7102 启动 (:1080)' },
  { timestamp: new Date(Date.now() - 190000).toLocaleTimeString(), type: 'PERSIST', message: 'BOT-US-3319 深度持久化驻留安装成功 (systemd service)' },
  { timestamp: new Date(Date.now() - 110000).toLocaleTimeString(), type: 'SCAN', message: 'BOT-DE-1823 完成网段 192.168.1.0/24 内网端口探测' },
  { timestamp: new Date(Date.now() - 30000).toLocaleTimeString(), type: 'HEARTBEAT', message: '全部受控端心跳正常，未发现丢包与异常脱网' }
];

let attacks = [
  { method: 'UDP-FLOOD', target: '198.51.100.42', port: 80, duration: 300, elapsed: 48, remaining: 252 },
  { method: 'TCP-SYN', target: '203.0.113.19', port: 443, duration: 180, elapsed: 35, remaining: 145 }
];

let scanResults = [
  { timestamp: '12:02:11', botID: 'BOT-SG-7102', type: 'SSH爆破成功', target: '192.168.1.15:22', result: 'root : password123' },
  { timestamp: '12:05:40', botID: 'BOT-US-3319', type: '端口服务发现', target: '10.0.0.8:8080', result: 'Apache Tomcat/9.0.58 Dashboard' },
  { timestamp: '12:11:03', botID: 'BOT-DE-1823', type: 'Telnet爆破成功', target: '192.168.1.1:23', result: 'admin : admin' },
  { timestamp: '12:18:29', botID: 'BOT-NL-6601', type: '端口服务发现', target: '172.16.0.4:3389', result: 'Windows RDP (NLA enabled)' }
];

let users = [
  { username: 'admin', password: 'admin', level: 'Owner', maxtime: 7200, concurrents: 10, maxbots: '无限制', api_key: 'c2-adm-8849-sec' },
  { username: 'operator', password: 'operator', level: 'Admin', maxtime: 3600, concurrents: 5, maxbots: 200, api_key: 'c2-op-3310-sec' }
];

// SSE Clients
const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// ---------------------------------------------------------------------------
// Authentication & Page Routes
// ---------------------------------------------------------------------------
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '请输入用户名和密码' });
  }

  const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingUser && existingUser.password && existingUser.password !== password) {
    return res.status(401).json({ success: false, error: '密码错误' });
  }

  // Accept admin/admin or valid user or auto-authenticate
  res.cookie('c2_session', username, { path: '/', httpOnly: false });
  return res.json({ success: true });
});

app.post('/api/auth/apikey', (req, res) => {
  const { api_key } = req.body || {};
  if (!api_key) {
    return res.status(400).json({ success: false, error: '请输入 API Key' });
  }

  const matched = users.find(u => u.api_key === api_key);
  if (matched || api_key === 'c2-adm-8849-sec') {
    res.cookie('c2_session', matched ? matched.username : 'admin', { path: '/', httpOnly: false });
    return res.json({ success: true });
  }

  return res.status(401).json({ success: false, error: '无效的 API Key' });
});

app.get('/logout', (req, res) => {
  res.clearCookie('c2_session');
  res.redirect('/login');
});

app.get('/', (req, res) => {
  // If user has session cookie, serve dashboard.html
  // Also default to dashboard if guest query or direct access
  if (req.cookies.c2_session) {
    return res.sendFile(path.join(__dirname, 'dashboard.html'));
  }
  // If first time visiting without session, auto-authenticate demo session so dashboard works seamlessly
  res.cookie('c2_session', 'admin', { path: '/', httpOnly: false });
  return res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const totalRAM = bots.reduce((sum, b) => sum + (b.ram || 0), 0);
  const totalCPU = bots.reduce((sum, b) => sum + (b.cpuCores || 0), 0);
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMins = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeStr = `${uptimeHours}h ${uptimeMins}m`;

  res.json({
    botCount: bots.length,
    totalRAM: totalRAM,
    totalCPU: totalCPU,
    uptime: uptimeStr
  });
});

app.get('/api/bots', (req, res) => {
  res.json(bots);
});

app.get('/api/activity', (req, res) => {
  res.json(activityLog);
});

app.get('/api/attacks', (req, res) => {
  // Update attack remaining times
  attacks = attacks.map(a => {
    const elapsed = a.elapsed + 1;
    const remaining = Math.max(0, a.duration - elapsed);
    return { ...a, elapsed, remaining };
  }).filter(a => a.remaining > 0);

  res.json(attacks);
});

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { username, password, level, maxtime, concurrents, maxbots } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }

  const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, error: '用户已存在' });
  }

  const randomKey = 'c2-usr-' + Math.floor(1000 + Math.random() * 9000) + '-sec';
  users.push({
    username,
    password,
    level: level || 'Member',
    maxtime: parseInt(maxtime) || 300,
    concurrents: parseInt(concurrents) || 5,
    maxbots: parseInt(maxbots) || 100,
    api_key: randomKey
  });

  activityLog.unshift({
    timestamp: new Date().toLocaleTimeString(),
    type: 'USER',
    message: `创建新用户账号: ${username} (权限: ${level || 'Member'}, 配额: ${maxbots || 100}台)`
  });
  broadcastSSE('activity', {});

  res.json({ success: true, message: '用户创建成功' });
});

app.delete('/api/users', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ success: false, error: '未指定要删除的用户名' });
  }
  if (username === 'admin') {
    return res.status(400).json({ success: false, error: '不能删除默认管理员账户' });
  }

  users = users.filter(u => u.username !== username);
  activityLog.unshift({
    timestamp: new Date().toLocaleTimeString(),
    type: 'USER',
    message: `删除用户账号: ${username}`
  });
  broadcastSSE('activity', {});

  res.json({ success: true });
});

app.get('/api/scan_results', (req, res) => {
  res.json(scanResults);
});

app.delete('/api/scan_results', (req, res) => {
  scanResults = [];
  res.json({ success: true });
});

// Helper for simulated execution output
function generateSimulatedOutput(cmd, targetBot) {
  const trimmed = cmd.trim();
  if (trimmed.startsWith('!shell ')) {
    const shCmd = trimmed.replace('!shell ', '').trim();
    if (shCmd === 'whoami') return 'root';
    if (shCmd === 'id') return 'uid=0(root) gid=0(root) groups=0(root)';
    if (shCmd === 'uname -a') return 'Linux node-host 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux';
    if (shCmd.startsWith('ls')) return 'bin   dev  home  lib64       mnt  proc  run   srv  tmp  var\nboot  etc  lib   lost+found  opt  root  sbin  sys  usr';
    if (shCmd.startsWith('ps')) return 'PID   USER     TIME  COMMAND\n1     root     0:02  /sbin/init\n1420  root     0:15  kworker/u8:2\n2801  root     0:08  systemd-journald-aux\n4102  root     0:00  ps aux';
    if (shCmd === 'uptime') return ' 12:45:01 up 14 days,  3:18,  1 user,  load average: 0.12, 0.08, 0.05';
    if (shCmd.startsWith('cat /etc/issue') || shCmd.startsWith('cat /etc/os-release')) return 'Ubuntu 22.04.4 LTS \\n \\l';
    if (shCmd === 'ip addr' || shCmd === 'ifconfig') return '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global eth0';
    return `[+] 指令执行完毕 (退出码: 0)\n${shCmd}: 执行成功`;
  }
  if (trimmed.startsWith('!detach')) {
    return '[+] 命令已成功移交至后台守护线程 (fork + setsid)，脱离控制台运行。';
  }
  if (trimmed === '!rootkit status' || trimmed === '!rootkit') {
    return '[+] Rootkit 状态检测:\n  [✓] LD_PRELOAD 动态注入: 正常激活\n  [✓] 进程伪装与隐藏: PID 1420, 2801 (已隐藏)\n  [✓] 网络监听隐藏: 端口 1080 (已过滤 netstat 视图)';
  }
  if (trimmed.startsWith('!rootkit install')) {
    return '[+] 成功编译并部署轻量级 LD_PRELOAD 模块至 /lib/x86_64-linux-gnu/libpam_auth.so.2\n[+] 已写入 /etc/ld.so.preload 隐藏标记。';
  }
  if (trimmed.startsWith('!rootkit remove')) {
    return '[+] 已清除 /etc/ld.so.preload 隐藏配置，卸载 Rootkit 痕迹。';
  }
  if (trimmed.startsWith('!persist')) {
    return '[+] 深度持久化驻留已完成:\n  [✓] 二进制备份复制至 /usr/lib/systemd/systemd-udevd-aux\n  [✓] 注册 crontab 每 10 分钟看门狗\n  [✓] 部署 systemd 自动启动守护单元';
  }
  if (trimmed.startsWith('!socks')) {
    return '[+] SOCKS5 代理服务启动成功，监听本地及转发端口 1080 (支持身份验证)';
  }
  if (trimmed.startsWith('!stopsocks')) {
    return '[+] SOCKS5 代理服务已停止并释放端口';
  }
  if (trimmed.startsWith('!portscan')) {
    return '[+] 内网端口扫描完成:\n  22/tcp   OPEN   OpenSSH 8.9p1\n  80/tcp   OPEN   nginx/1.18.0\n  443/tcp  OPEN   nginx/1.18.0 (TLS)\n  3389/tcp FILTERED\n  8080/tcp OPEN   Apache Tomcat';
  }
  if (trimmed.startsWith('!portfwd')) {
    return '[+] TCP 端口转发隧道已建立: 本地端口 -> 目标主机端口';
  }
  if (trimmed.startsWith('!stopportfwd')) {
    return '[+] 已关闭受控端本地端口转发隧道并释放端口绑定。';
  }
  if (trimmed.startsWith('!reinstall')) {
    return '[+] 收到新 Payload 下载请求，已成功拉取并使用 syscall.Exec 替换当前进程。';
  }
  if (trimmed.startsWith('!telnet_scan') || trimmed.startsWith('!ssh_scan')) {
    return '[+] 扫描任务已在后台启动并发工作线程，发现凭据将实时上报...';
  }
  if (trimmed.startsWith('!realtek_scan')) {
    return '[+] Realtek Jungle SDK 漏洞探测完成 (CVE-2021-35394):\n  [✓] 发现存活易受攻击目标: 192.168.1.1:80 (RTL819xD)\n  [✓] 成功发送任意命令执行测试 Payload (sys cmd ok)';
  }
  if (trimmed.startsWith('!antidbg')) {
    return '[+] 反调试与沙箱特征检测完成:\n  [✓] ptrace 挂钩检测: 安全 (未被附加)\n  [✓] 虚拟机指纹 (VMware/QEMU): 伪装成功 (隐蔽运行)\n  [✓] 断点扫描与调试器环境: 清洁';
  }
  if (trimmed.startsWith('!harvest')) {
    return '[+] 敏感凭据收割完毕:\n  [✓] 提取 ~/.ssh/id_rsa 私钥 (2048-bit)\n  [✓] 读取 ~/.bash_history 历史凭据 12 条\n  [✓] 探测 /etc/hosts 内网横向映射 4 个目标';
  }
  if (trimmed.startsWith('!killer')) {
    return '[+] 竞品杀手已遍历 /proc，成功清除 2 个恶意占用端口的挖矿僵尸进程。';
  }
  if (trimmed === '!stop' || trimmed === '!stop_scan') {
    return '[+] 已向受控线程发送中止信号，任务已停止。';
  }
  if (trimmed === '!kill') {
    return '[+] 受控端自毁程序已触发: 清除运行目录并退出进程。';
  }
  return `[+] 指令 "${trimmed}" 已接收并在受控环境中执行。`;
}

app.post('/api/command', (req, res) => {
  const { command, botID } = req.body || {};
  if (!command) {
    return res.status(400).json({ success: false, error: '命令不能为空' });
  }

  // Handle attack commands
  if (command.startsWith('!UDP-FLOOD') || command.startsWith('!TCP-SYN') || command.startsWith('!HTTP-GET') || command.startsWith('!HTTP-POST')) {
    const parts = command.split(' ');
    const method = parts[0].replace('!', '');
    const target = parts[1] || '127.0.0.1';
    const port = parseInt(parts[2]) || 80;
    const duration = parseInt(parts[3]) || 60;
    attacks.push({
      method,
      target,
      port,
      duration,
      elapsed: 0,
      remaining: duration
    });
    activityLog.unshift({
      timestamp: new Date().toLocaleTimeString(),
      type: 'ATTACK',
      message: `下发攻击任务: ${method} 目标 ${target}:${port} 时长 ${duration}s`
    });
    broadcastSSE('activity', {});
  } else if (command === '!stop') {
    attacks = [];
    activityLog.unshift({
      timestamp: new Date().toLocaleTimeString(),
      type: 'ATTACK',
      message: '停止全部进行中的攻击任务'
    });
    broadcastSSE('activity', {});
  } else {
    // Record command in activity
    activityLog.unshift({
      timestamp: new Date().toLocaleTimeString(),
      type: 'COMMAND',
      message: `下发指令 [${command}] 到 ${botID ? botID : '全部广播节点'}`
    });
    broadcastSSE('activity', {});
  }

  // Simulate asynchronous bot feedback output via SSE
  const targetId = botID || (bots.length > 0 ? bots[0].botID : 'BOT-SG-7102');
  setTimeout(() => {
    const output = generateSimulatedOutput(command, targetId);
    broadcastSSE('bot_output', {
      botID: targetId,
      output: output,
      timestamp: new Date().toLocaleTimeString()
    });

    // If scanning, simulate finding a credential after 2 seconds
    if (command.startsWith('!telnet_scan') || command.startsWith('!ssh_scan')) {
      setTimeout(() => {
        const isSSH = command.startsWith('!ssh_scan');
        const newResult = {
          timestamp: new Date().toLocaleTimeString(),
          botID: targetId,
          type: isSSH ? 'SSH爆破成功' : 'Telnet爆破成功',
          target: isSSH ? '10.0.0.22:22' : '192.168.1.100:23',
          result: isSSH ? 'admin : P@ssw0rd2026' : 'root : 123456'
        };
        scanResults.unshift(newResult);
        broadcastSSE('scan_result', newResult);
      }, 2000);
    }
  }, 400);

  res.json({
    success: true,
    message: `命令 [${command}] 已成功下发至 ${botID ? ('受控端 ' + botID) : '全部受控端'}`
  });
});

// ---------------------------------------------------------------------------
// Server-Sent Events (SSE) Stream
// ---------------------------------------------------------------------------
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(': connected\n\n');

  sseClients.add(res);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ---------------------------------------------------------------------------
// WebSocket for Interactive PTY Shell
// ---------------------------------------------------------------------------
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const botID = url.searchParams.get('botID') || 'BOT-SG-7102';

  // Send initial welcome message and shell prompt
  ws.send(JSON.stringify({
    type: 'output',
    output: `\r\n=== VisionC2 Interactive PTY Session ===\r\nNode ID: ${botID}\r\nOS: Linux 5.15.0-generic x86_64\r\nTTY: /dev/pts/3 (raw mode)\r\n\r\nroot@${botID}:~# `
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const cmd = (data.command || '').trim();
      let output = '';

      if (cmd === 'whoami') {
        output = 'root\r\n';
      } else if (cmd === 'id') {
        output = 'uid=0(root) gid=0(root) groups=0(root)\r\n';
      } else if (cmd === 'uname -a') {
        output = 'Linux node 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux\r\n';
      } else if (cmd === 'pwd') {
        output = '/root\r\n';
      } else if (cmd.startsWith('ls')) {
        output = '.bashrc  .profile  .ssh  kworker_u8  loader.sh  persistence.sh\r\n';
      } else if (cmd.startsWith('cat')) {
        output = '# Configuration file\r\nSERVER_HOST=0.0.0.0\r\nPORT=3000\r\nSTATUS=ONLINE\r\n';
      } else if (cmd === 'clear') {
        output = '\x1b[2J\x1b[H';
      } else if (cmd === 'exit') {
        output = 'logout\r\nSession closed.\r\n';
        ws.send(JSON.stringify({ type: 'output', output }));
        ws.close();
        return;
      } else if (cmd) {
        output = `[PTY] ${cmd}: command executed successfully\r\n`;
      }

      ws.send(JSON.stringify({
        type: 'output',
        output: `${output}root@${botID}:~# `
      }));
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'output',
        output: `Error parsing command: ${err.message}\r\nroot@${botID}:~# `
      }));
    }
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  console.log(`[VisionC2] Server running on http://${HOST}:${PORT}`);
});
