import { relayClient } from './websocket';
import { storage } from './storage';
import { useAppStore } from '../store';

export async function attemptAutoConnect(): Promise<boolean> {
  const urls = await storage.getServerUrls();
  const singleUrl = await storage.getServerUrl();
  const token = await storage.getToken();
  const candidates = (urls && urls.length ? urls : (singleUrl ? [singleUrl] : []));
  if (!candidates.length || !token) return false;

  useAppStore.getState().setServerUrl(candidates[candidates.length - 1]);

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(ok);
    };

    const unsub = relayClient.onMessage((msg) => {
      if (msg.type === 'auth_result') {
        if (msg.payload.success) {
          finish(true);
        } else {
          storage.clearToken();
          finish(false);
        }
      }
    });

    relayClient.setStateListener((state) => {
      useAppStore.getState().setConnectionState(state);
      if (state === 'connected') {
        relayClient.send({ type: 'auth', payload: { token } });
      }
    });

    relayClient.connect(candidates);

    timer = setTimeout(() => finish(false), 15000);
  });
}

export async function pairAndSave(candidates: string[], code: string): Promise<boolean> {
  const list = candidates.map(u => (u || '').trim()).filter(Boolean);
  if (!list.length) return false;
  await storage.setServerUrls(list);
  await storage.setServerUrl(list[list.length - 1]);
  useAppStore.getState().setServerUrl(list[list.length - 1]);

  relayClient.disconnect();

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(ok);
    };

    const unsub = relayClient.onMessage((msg) => {
      if (msg.type === 'auth_result') {
        if (msg.payload.success && msg.payload.token) {
          const token = msg.payload.token as string;
          relayClient.setToken(token);
          storage.setToken(token);
          finish(true);
        }
      }
    });

    relayClient.setStateListener((state) => {
      useAppStore.getState().setConnectionState(state);
      if (state === 'connected') {
        relayClient.send({ type: 'auth', payload: { pairingCode: code } });
      }
    });

    relayClient.connect(list);
    timer = setTimeout(() => finish(false), 15000);
  });
}
