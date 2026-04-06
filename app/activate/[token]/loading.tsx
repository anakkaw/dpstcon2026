import { getServerTranslator } from "@/lib/i18n/server";
import { PageLoading } from "@/components/ui/page-loading";

export default async function ActivateLoading() {
  const { t } = await getServerTranslator();

  return (
    <PageLoading
      label={t("common.loading")}
      description={t("common.pleaseWait")}
    />
  );
}
