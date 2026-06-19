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

  // Emit a single scannable QR that carries everything the app needs to pair
  // (server url + pairing code), so users don't have to hand-type a long
  // tunnel address. Prefer the public tunnel url when available, else LAN.
  const wsUrl = tunnelUrl
    ? tunnelUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
    : `ws://${localIp}:${config.port}`;
  await printConnectionQr(wsUrl, pairingCode);

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

// Print a QR encoding a JSON pairing payload {url, code} so the mobile app can
// scan once instead of hand-typing a long tunnel address plus the code.
async function printConnectionQr(wsUrl: string, pairingCode: string): Promise<void> {
  const payload = JSON.stringify({ url: wsUrl, code: pairingCode });
  console.log('');
  console.log(`  Connect URL : ${wsUrl}`);
  console.log(`  Pairing code: ${pairingCode}`);
  console.log('  Scan this QR in the app (or enter the above manually):');
  console.log('');
  try {
    const qr: any = await import('qrcode-terminal');
    qr.generate(payload, { small: true });
  } catch {
    // qrcode-terminal is optional; the printed URL + code above is the fallback.
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
