/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

async function fetchJsonWithTimeout(url: string, timeoutMs = 3000): Promise<{ ok: boolean; data?: any; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let data: any = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Keep non-JSON response for diagnostics.
    }
    return response.ok ? { ok: true, data } : { ok: false, data, error: `HTTP ${response.status}` };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'request_failed' };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/runtime-check', async (_req, res) => {
  const ccSwitchBase = process.env.CCSWITCH_BASE_URL || 'http://127.0.0.1:15721';
  const backendBase = process.env.CABINET_BACKEND_URL || 'http://127.0.0.1:8000';
  const [ccHealth, ccStatus, backendHealth] = await Promise.all([
    fetchJsonWithTimeout(`${ccSwitchBase}/health`),
    fetchJsonWithTimeout(`${ccSwitchBase}/status`),
    fetchJsonWithTimeout(`${backendBase}/health`),
  ]);
  const status = ccStatus.data || {};
  const serviceOk = ccHealth.ok && ccStatus.ok;
  const routeReady = Boolean(serviceOk && status.current_provider_id && !status.last_error);
  return res.json({
    generatedAt: new Date().toISOString(),
    app: { ok: true, url: `http://127.0.0.1:${PORT}` },
    ccSwitch: {
      ok: routeReady,
      health: ccHealth.ok,
      serviceOk,
      routeReady,
      provider: status.current_provider || '',
      providerId: status.current_provider_id || '',
      activeTargets: Array.isArray(status.active_targets) ? status.active_targets : [],
      lastError: status.last_error || ccHealth.error || ccStatus.error || '',
      url: ccSwitchBase,
    },
    backend: {
      ok: backendHealth.ok,
      url: backendBase,
      error: backendHealth.error || '',
    },
    features: {
      issueReporting: { ok: backendHealth.ok, endpoint: '/api/issues' },
      imageGeneration: { ok: backendHealth.ok, endpoint: '/api/images/generate' },
    },
  });
});

async function proxyBackendPost(pathname: string, body: unknown, res: express.Response) {
  const backendBase = (process.env.CABINET_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backendBase}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(text);
  } catch (error: any) {
    res.status(503).json({ ok: false, error: error?.message || 'Backend unavailable' });
  }
}

async function proxyBackendGet(pathname: string, res: express.Response) {
  const backendBase = (process.env.CABINET_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backendBase}${pathname}`);
    const text = await response.text();
    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(text);
  } catch (error: any) {
    res.status(503).json({ ok: false, error: error?.message || 'Backend unavailable' });
  }
}

app.get('/api/ccswitch/providers', async (_req, res) => {
  await proxyBackendGet('/api/ccswitch/providers', res);
});

app.post('/api/ccswitch/providers/:profileId/test', async (req, res) => {
  await proxyBackendPost(`/api/ccswitch/providers/${encodeURIComponent(req.params.profileId)}/test`, req.body || {}, res);
});

app.post('/api/issues', async (req, res) => {
  await proxyBackendPost('/api/issues', req.body, res);
});

app.post('/api/images/generate', async (req, res) => {
  await proxyBackendPost('/api/images/generate', req.body, res);
});

app.post('/api/ccswitch/test', async (req, res) => {
  await proxyBackendPost('/api/ccswitch/test', req.body, res);
});

app.post('/api/ccswitch/launch', async (req, res) => {
  await proxyBackendPost('/api/ccswitch/launch', req.body, res);
});

app.post('/api/provider/test', async (req, res) => {
  await proxyBackendPost('/api/provider/test', req.body, res);
});

// Debate + finalize are handled by the FastAPI backend (single source of truth).
// The Node server only proxies, so dev (3000) and production (8000) behave identically.
app.post('/api/debate', async (req, res) => {
  if (!req.body?.query) {
    return res.status(400).json({ error: 'Query is required.' });
  }
  await proxyBackendPost('/api/debate', req.body, res);
});

app.post('/api/finalize', async (req, res) => {
  await proxyBackendPost('/api/finalize', req.body, res);
});


// Setup Vite Dev server or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server fully booted on http://localhost:${PORT}`);
  });
}

startServer();
