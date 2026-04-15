import { useTranslation } from "react-i18next";
import {
  Content,
  ContentItem,
  ContentItemForm,
  ContentItemTitle,
  ContentSeparator,
  Header,
  HeaderDescription,
  HeaderTitle,
  Root,
} from "@/app/components/settings/section";
import { NumericInput } from "@/app/components/ui/numeric-input";
import {
  usePlayHistoryActions,
  usePlayHistoryMaxSize,
} from "@/store/playHistory.store";

export function HistorySettings() {
  const { t } = useTranslation();
  const maxSize = usePlayHistoryMaxSize();
  const { setMaxSize } = usePlayHistoryActions();

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.audio.history.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.audio.history.description")}
        </HeaderDescription>
      </Header>
      <Content>
        <ContentItem>
          <ContentItemTitle info={t("settings.audio.history.maxSize.info")}>
            {t("settings.audio.history.maxSize.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <NumericInput
              value={maxSize}
              onChange={setMaxSize}
              min={10}
              max={1000}
              step={10}
            />
          </ContentItemForm>
        </ContentItem>
      </Content>
      <ContentSeparator />
    </Root>
  );
}
