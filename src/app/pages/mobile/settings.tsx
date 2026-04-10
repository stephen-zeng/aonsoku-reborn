import {
  CircleUserRound,
  EarthLock,
  FileText,
  Globe,
  HardDrive,
  Headphones,
  LaptopIcon,
  Paintbrush,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Accounts } from "@/app/components/settings/pages/accounts";
import { Appearance } from "@/app/components/settings/pages/appearance";
import { Audio } from "@/app/components/settings/pages/audio";
import { Content } from "@/app/components/settings/pages/content";
import { Desktop } from "@/app/components/settings/pages/desktop";
import { Language } from "@/app/components/settings/pages/language";
import { Privacy } from "@/app/components/settings/pages/privacy";
import { Storage } from "@/app/components/settings/pages/storage";
import { SettingsOptions } from "@/app/components/settings/options";
import { isDesktop } from "@/utils/desktop";

interface CategoryItem {
  id: SettingsOptions;
  icon: ComponentType<{ className?: string }>;
}

const accountsOption: CategoryItem = { id: "accounts", icon: CircleUserRound };
const desktopOption: CategoryItem = { id: "desktop", icon: LaptopIcon };

const categories: CategoryItem[] = [
  { id: "appearance", icon: Paintbrush },
  { id: "language", icon: Globe },
  { id: "audio", icon: Headphones },
  { id: "content", icon: FileText },
  { id: "storage", icon: HardDrive },
  ...(isDesktop() ? [accountsOption, desktopOption] : []),
  { id: "privacy", icon: EarthLock },
];

const pages: Record<SettingsOptions, () => JSX.Element> = {
  appearance: () => <Appearance />,
  audio: () => <Audio />,
  language: () => <Language />,
  content: () => <Content />,
  storage: () => <Storage />,
  accounts: () => <Accounts />,
  desktop: () => <Desktop />,
  privacy: () => <Privacy />,
};

export default function MobileSettings() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = searchParams.get("page") as SettingsOptions | null;

  function openPage(id: SettingsOptions) {
    setSearchParams({ page: id });
  }

  function goBack() {
    setSearchParams({});
  }

  if (currentPage && pages[currentPage]) {
    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-muted-foreground active:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("settings.label")}
          </button>
          <span className="text-sm font-medium ml-1">
            {t(`settings.options.${currentPage}`)}
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">{pages[currentPage]()}</div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold">{t("settings.label")}</h1>
      </div>
      <div className="flex flex-col">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openPage(item.id)}
            className="flex items-center gap-3 px-4 py-3.5 active:bg-accent/50 transition-colors border-b last:border-b-0"
          >
            <item.icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-sm text-left">
              {t(`settings.options.${item.id}`)}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
