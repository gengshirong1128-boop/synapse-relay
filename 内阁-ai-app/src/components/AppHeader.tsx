import { GitMerge, Languages, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AppTranslator } from '../types';

type AppHeaderProps = {
  busy: string;
  t: AppTranslator;
  onRefreshAgents: () => void;
  onToggleLanguage: () => void;
};

export function AppHeader({ busy, t, onRefreshAgents, onToggleLanguage }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><GitMerge size={19} /></div>
        <div>
          <strong>{t('appName')}</strong>
          <span>{t('appTagline')}</span>
        </div>
      </div>
      <div className="topbar-right">
        <span><ShieldCheck size={15} /> {t('declareFirst')}</span>
        <span><LockKeyhole size={15} /> {t('fileLocks')}</span>
        <button className="ghost-button" onClick={onToggleLanguage}>
          <Languages size={15} /> {t('switchLanguage')}
        </button>
        <button className="ghost-button" disabled={busy === 'agents'} onClick={onRefreshAgents}>
          <RefreshCw size={15} /> {t('refreshAgents')}
        </button>
      </div>
    </header>
  );
}
