import { ComingSoon } from '../components/ComingSoon';
import { useI18n } from '../i18n';

export function History() {
  const { t } = useI18n();
  return (
    <ComingSoon title={t('history.title')} empty={t('history.empty')}>
      {t('history.body')}
    </ComingSoon>
  );
}
