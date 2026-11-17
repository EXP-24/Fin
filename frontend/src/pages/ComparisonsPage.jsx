import { useLanguage } from "../i18n.jsx";

export default function ComparisonsPage() {
  const { t } = useLanguage();
  return (
    <div className="w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined text-[24px]">compare_arrows</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{t("Comparisons")}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t("Your market comparison sessions.")}</p>
        </div>
      </div>

      <div className="bg-surface-container-low p-12 rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-[32px]">query_stats</span>
        </div>
        <h3 className="font-headline-md-mobile text-headline-md-mobile text-on-surface mb-2">{t("No comparisons yet")}</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">{t("You haven't created any market comparisons. Go to the dashboard and ask to compare specific companies to get started.")}</p>
      </div>
    </div>
  );
}
