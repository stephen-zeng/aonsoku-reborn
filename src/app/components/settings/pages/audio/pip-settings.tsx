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
import { Switch } from "@/app/components/ui/switch";
import { usePipSettings } from "@/store/player.store";

export function PipSettings() {
  const { t } = useTranslation();
  const { acceptBrowserPipRequest, setAcceptBrowserPipRequest } =
    usePipSettings();

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.audio.pip.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.audio.pip.description")}
        </HeaderDescription>
      </Header>
      <Content>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.audio.pip.acceptBrowserRequest.info")}
          >
            {t("settings.audio.pip.acceptBrowserRequest.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={acceptBrowserPipRequest}
              onCheckedChange={setAcceptBrowserPipRequest}
            />
          </ContentItemForm>
        </ContentItem>
      </Content>
      <ContentSeparator />
    </Root>
  );
}