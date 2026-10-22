import { ComingSoon } from '../components/ComingSoon';
import { useI18n } from '../i18n';

export function NadiInsights() {
  const { t } = useI18n();
  return (
    <ComingSoon title={t('nadiScreen.title')} empty={t('nadiScreen.empty')} accent="turmeric">
      {t('nadiScreen.body')}
    </ComingSoon>
  );
}
