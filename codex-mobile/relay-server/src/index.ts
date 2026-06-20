import { networkInterfaces } from 'os';
import { loadConfig } from './config';
import { AuthManager } from './auth';
import { ProcessManager } from './process-manager';
import { RelayServer } from './ws-server';
import { TunnelManager } from './tunnel';
import { createLogger, setLogLevel } from './logger';

const log = createLogger('main');

async function main(): Promise<void> {
  const config = loadConfig();

  if (process.env.LOG_LEVEL === 'debug') setLogLevel('debug');

  const auth = new AuthManager(config);
  const processManager = new ProcessManager(config);
  const tunnel = new TunnelManager(config);
  const pairingCode = auth.generatePairingCode();
  const lanIps = getLanIps();

  printStartupBanner(config.port, pairingCode, lanIps[0]);

  const server = new RelayServer(config, auth, processManager);

  let tunnelUrl: string | null = null;
  if (config.tunnelEnabled) {
    log.info('Starting Cloudflare Tunnel...');
    tunnelUrl = await tunnel.start();
    if (tunnelUrl) {
      log.info('Tunnel active', { url: tunnelUrl });
    } else {
      log.warn('Tunnel failed, LAN only');
    }
  }

  log.info('Waiting for connections...');

  // Emit a single scannable QR that carries everything the app needs to pair.
  // We send BOTH the LAN url and the tunnel url so the app can prefer the
  // direct LAN path when on the same WiFi (fast, no idle-disconnects) and fall
  // back to the tunnel only when off-network. Sending tunnel-only made same-WiFi
  // traffic detour through Cloudflare overseas — slow and frequently dropped.
  const lanUrls = lanIps.map(ip => `ws://${ip}:${config.port}`);
  const tunnelWsUrl = tunnelUrl
    ? tunnelUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
    : '';
  await printConnectionQr(lanUrls, tunnelWsUrl, pairingCode);

  process.on('SIGINT', () => {
    log.info('Shutting down');
    server.close();
    tunnel.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.close();
    tunnel.stop();
    process.exit(0);
  });
}

function printStartupBanner(port: number, pairingCode: string, localIp: string): void {
  console.log('');
  console.log('  +--------------------------------------+');
  console.log('  | CodexMobile Relay Server             |');
  console.log('  +--------------------------------------+');
  console.log(`  | Port: ${String(port).padEnd(30)} |`);
  console.log(`  | Code: ${pairingCode.padEnd(30)} |`);
  console.log(`  | LAN:  ${`ws://${localIp}:${port}`.padEnd(30)} |`);
  console.log('  +--------------------------------------+');
  console.log('');
}

// Print a QR encoding a JSON pairing payload {lanUrls, tunnelUrl, code} so the
// mobile app can scan once and then pick the best path: a LAN/VPN address when
// reachable (same WiFi or ZeroTier → direct, fast), tunnel otherwise.
async function printConnectionQr(lanUrls: string[], tunnelUrl: string, pairingCode: string): Promise<void> {
  const payload = JSON.stringify({ lanUrls, tunnelUrl, code: pairingCode });
  console.log('');
  lanUrls.forEach((u, i) => console.log(`  LAN URL ${i + 1}   : ${u}  (直连，优先、快)`));
  if (tunnelUrl) console.log(`  Tunnel URL  : ${tunnelUrl}  (外网/4G 兜底)`);
  console.log(`  Pairing code: ${pairingCode}`);
  console.log('  Scan this QR in the app (or enter the above manually):');
  console.log('');
  try {
    const qr: any = await import('qrcode-terminal');
    qr.generate(payload, { small: true });
  } catch {
    // qrcode-terminal is optional; the printed URLs + code above is the fallback.
  }
}

// Collect all usable LAN/VPN IPv4 addresses, best-first, so the app can probe
// them in order: physical WiFi/Ethernet (fastest on same network), then P2P
// VPN addresses (ZeroTier/Tailscale — these traverse NAT and campus isolation,
// giving a direct connection off-network). We exclude only true VM/container
// adapters (VMware/VirtualBox/Docker), which aren't reachable from the phone.
function getLanIps(): string[] {
  const nets = networkInterfaces();
  const candidates: { address: string; score: number }[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      // Skip link-local / APIPA (169.254.x.x) — never routable to the phone.
      if (net.address.startsWith('169.254.')) continue;
      const lowered = name.toLowerCase();
      const isVmAdapter = /vmware|virtualbox|veth|vethernet|docker|hyper-v/.test(lowered);
      if (isVmAdapter) continue;
      const isVpn = /zerotier|tailscale|wireguard|zt/.test(lowered);
      const isPhysical = /wlan|wi-?fi|wireless|ethernet|以太网/.test(lowered);
      // Physical LAN first (fastest same-network), then VPN (works anywhere),
      // then anything else.
      const score = isPhysical ? 30 : isVpn ? 20 : 10;
      candidates.push({ address: net.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const ips = candidates.map(c => c.address);
  return ips.length ? ips : ['127.0.0.1'];
}

main();
