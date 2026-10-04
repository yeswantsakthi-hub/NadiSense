import { ComingSoon } from '../components/ComingSoon';
import { useI18n } from '../i18n';

export function Report() {
  const { t } = useI18n();
  return (
    <ComingSoon title={t('report.title')} empty={t('report.empty')}>
      {t('report.body')}
    </ComingSoon>
  );
}
