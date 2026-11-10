import { ComingSoon } from '../components/ComingSoon';
import { useI18n } from '../i18n';

export function EcgCheck() {
  const { t } = useI18n();
  return (
    <ComingSoon
      title={t('ecg.title')}
      tag={t('v2.tag')}
      items={[
        { name: t('v2.ecgTitle'), why: t('v2.ecgWhy') },
        { name: t('v2.bpTitle'), why: t('v2.bpWhy') },
      ]}
      footnote={t('app.disclaimer')}
    />
  );
}
