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
  const localIp = getLocalIp();

  printStartupBanner(config.port, pairingCode, localIp);

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
  const lanUrl = `ws://${localIp}:${config.port}`;
  const tunnelWsUrl = tunnelUrl
    ? tunnelUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
    : '';
  await printConnectionQr(lanUrl, tunnelWsUrl, pairingCode);

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

// Print a QR encoding a JSON pairing payload {lanUrl, tunnelUrl, code} so the
// mobile app can scan once and then pick the best path: LAN when reachable
// (same WiFi → direct, fast), tunnel otherwise (remote / 4G).
async function printConnectionQr(lanUrl: string, tunnelUrl: string, pairingCode: string): Promise<void> {
  const payload = JSON.stringify({ lanUrl, tunnelUrl, code: pairingCode });
  console.log('');
  console.log(`  LAN URL     : ${lanUrl}  (同一 WiFi，优先、快)`);
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

function getLocalIp(): string {
  const nets = networkInterfaces();
  const candidates: { name: string; address: string; score: number }[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const lowered = name.toLowerCase();
      const isVirtual = /vmware|virtualbox|veth|vethernet|docker|loopback|tailscale/.test(lowered);
      const isPreferred = /wlan|wi-?fi|wireless|ethernet/.test(lowered);
      candidates.push({
        name,
        address: net.address,
        score: (isPreferred ? 10 : 0) - (isVirtual ? 20 : 0),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0]) return candidates[0].address;
  return '127.0.0.1';
}

main();
