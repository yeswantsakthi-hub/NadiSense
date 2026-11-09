import { ComingSoon } from '../components/ComingSoon';
import { useI18n } from '../i18n';

/** Everything the v1 ring can't measure yet, in one place. No numbers are ever shown here. */
export function NadiInsights() {
  const { t } = useI18n();
  return (
    <ComingSoon
      title={t('nadiScreen.title')}
      tag={t('v2.tag')}
      items={[
        { name: t('v2.nadiTitle'), why: t('v2.nadiWhy') },
        { name: t('v2.ecgTitle'), why: t('v2.ecgWhy') },
        { name: t('v2.bpTitle'), why: t('v2.bpWhy') },
        { name: t('v2.sleepTitle'), why: t('v2.sleepWhy') },
      ]}
      footnote={t('app.disclaimer')}
    />
  );
}
