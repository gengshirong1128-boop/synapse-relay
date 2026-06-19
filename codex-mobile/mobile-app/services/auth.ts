import { relayClient } from './websocket';
import { storage } from './storage';
import { useAppStore } from '../store';

export async function attemptAutoConnect(): Promise<boolean> {
  const url = await storage.getServerUrl();
  const token = await storage.getToken();
  if (!url || !token) return false;

  useAppStore.getState().setServerUrl(url);

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

    relayClient.connect(url);

    timer = setTimeout(() => finish(false), 10000);
  });
}

export async function pairAndSave(url: string, code: string): Promise<boolean> {
  await storage.setServerUrl(url);
  useAppStore.getState().setServerUrl(url);

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
        } else {
          finish(false);
        }
      }
    });

    let authSent = false;
    relayClient.setStateListener((state) => {
      useAppStore.getState().setConnectionState(state);
      if (state === 'connected' && !authSent) {
        authSent = true;
        relayClient.send({ type: 'auth', payload: { pairingCode: code } });
      }
    });

    relayClient.connect(url);
    timer = setTimeout(() => finish(false), 10000);
  });
}
