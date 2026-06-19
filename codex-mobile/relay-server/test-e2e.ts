import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:8765';
let ws: WebSocket;
let token: string | null = null;

function send(msg: object): void {
  ws.send(JSON.stringify(msg));
}

function log(label: string, data: unknown): void {
  console.log(`[${label}]`, JSON.stringify(data, null, 2));
}

async function runTests(): Promise<void> {
  console.log('=== CodexMobile E2E Test ===\n');

  ws = new WebSocket(SERVER_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  console.log('[OK] Connected to relay server\n');

  // Test 1: Auth with pairing code
  console.log('--- Test 1: Authentication ---');
  const pairingCode = process.argv[2];
  if (!pairingCode) {
    console.error('Usage: tsx test-e2e.ts <pairing-code>');
    process.exit(1);
  }

  send({ type: 'auth', payload: { pairingCode } });

  const authResult = await waitForMessage('auth_result');
  if (!authResult.payload.success) {
    console.error('[FAIL] Auth failed');
    process.exit(1);
  }
  token = authResult.payload.token as string;
  console.log('[OK] Authenticated, token received\n');

  // Test 2: Reconnect with token
  console.log('--- Test 2: Token reconnect ---');
  ws.close();
  ws = new WebSocket(SERVER_URL);
  await new Promise<void>((resolve) => { ws.on('open', resolve); });
  send({ type: 'auth', payload: { token } });
  const reauth = await waitForMessage('auth_result');
  console.log(`[${reauth.payload.success ? 'OK' : 'FAIL'}] Token reauth\n`);

  // Test 3: File listing
  console.log('--- Test 3: File listing ---');
  send({ type: 'file_list', payload: { path: '.' } });
  const fileList = await waitForMessage('file_list_result');
  const files = fileList.payload.files as { name: string }[];
  console.log(`[OK] Got ${files.length} entries`);
  console.log(`     Files: ${files.slice(0, 5).map(f => f.name).join(', ')}...\n`);

  // Test 4: File read
  console.log('--- Test 4: File read ---');
  send({ type: 'file_content', payload: { path: 'package.json' } });
  const fileContent = await waitForMessage('file_content_result');
  const content = fileContent.payload.content as string;
  console.log(`[OK] Read package.json (${content.length} chars)\n`);

  // Test 5: Path traversal protection
  console.log('--- Test 5: Security - path traversal ---');
  send({ type: 'file_content', payload: { path: '../../../etc/passwd' } });
  const blocked = await waitForMessage('error');
  console.log(`[OK] Blocked: ${blocked.payload.message}\n`);

  // Test 6: Send command (if CLI available)
  console.log('--- Test 6: Command execution ---');
  send({ type: 'command', payload: { text: 'echo hello from codex-mobile', backend: 'claude-code' } });

  try {
    const output = await waitForMessage('output', 10000);
    console.log(`[OK] Got output: ${(output.payload.text as string).slice(0, 80)}\n`);
  } catch {
    console.log('[SKIP] No CLI output (claude not installed or timed out)\n');
  }

  console.log('=== All tests complete ===');
  ws.close();
  process.exit(0);
}

function waitForMessage(type: string, timeout = 5000): Promise<{ type: string; payload: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
    const handler = (raw: WebSocket.Data) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

runTests().catch((err) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
