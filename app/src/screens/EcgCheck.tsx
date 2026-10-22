import { ComingSoon } from '../components/ComingSoon';
import { useI18n } from '../i18n';

export function EcgCheck() {
  const { t } = useI18n();
  return (
    <ComingSoon title={t('ecg.title')} empty={t('ecg.empty')}>
      {t('ecg.body')}
    </ComingSoon>
  );
}
