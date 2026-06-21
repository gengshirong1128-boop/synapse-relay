import { LockKeyhole, Sparkles, Users, Waves, Zap } from 'lucide-react';
import type { AppTranslator, Plan } from '../types';

type HeroSectionProps = {
  callableAgentCount: number;
  plan: Plan | null;
  t: AppTranslator;
  onLoadStarter: () => void;
};

export function HeroSection({ callableAgentCount, plan, t, onLoadStarter }: HeroSectionProps) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">{t('heroEyebrow')}</span>
        <h1>{t('heroTitle')}<br /><em>{t('heroAccent')}</em></h1>
        <p>{t('heroDescription')}</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => document.getElementById('plan-form')?.scrollIntoView({ behavior: 'smooth' })}>
            <Zap size={16} /> {t('newPlan')}
          </button>
          <button className="ghost-button" onClick={onLoadStarter}><Sparkles size={15} /> {t('useStarter')}</button>
        </div>
      </div>
      <div className="hero-proof">
        <div><Users /><strong>{callableAgentCount}</strong><span>{t('callableAgents')}</span></div>
        <div><Waves /><strong>{plan?.waves.length || 0}</strong><span>{t('executionWaves')}</span></div>
        <div><LockKeyhole /><strong>{Object.keys(plan?.locks || {}).length}</strong><span>{t('activeLocks')}</span></div>
      </div>
    </section>
  );
}
