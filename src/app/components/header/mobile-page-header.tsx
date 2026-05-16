import { ChevronLeft } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserDropdown } from "@/app/components/header/user-dropdown";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { blendColors, hslToHex, isDarkHex } from "@/utils/getAverageColor";

type MobilePageHeaderVariant = "root" | "sub";

interface MobilePageHeaderProps {
  variant: MobilePageHeaderVariant;
  title: string;
  className?: string;
  onBack?: () => void;
  accentColor?: string;
  count?: number;
  actions?: ReactNode;
  showSpacer?: boolean;
}

function DesktopHeaderStatusItems() {
  return <UserDropdown />;
}

function MobileHeaderStatusItems({
  extra,
}: {
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {extra}
    </div>
  );
}

function StickyHeader({
  title,
  onBack,
  accentColor,
  actions,
}: {
  title: string;
  onBack?: () => void;
  accentColor?: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [titleInViewport, setTitleInViewport] = useState(true);
  const titleObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const titleEl = document.getElementById("detail-page-title");
    if (!titleEl) {
      setTitleInViewport(true);
      return;
    }

    if (titleObserverRef.current) {
      titleObserverRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setTitleInViewport(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(titleEl);
    titleObserverRef.current = observer;
    return () => observer.disconnect();
  }, []);

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }

  const showFullBar = !titleInViewport;

  const floatingOnImage = !showFullBar;

  const blendedColor = useMemo(() => {
    if (!accentColor) return undefined;
    const bgHsl = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    const baseHex = hslToHex(bgHsl);
    return blendColors(baseHex, accentColor, 0.35);
  }, [accentColor]);

  const accentBgStyle =
    showFullBar && blendedColor
      ? { backgroundColor: `${blendedColor}e6` }
      : undefined;

  const textColorClass = useMemo(() => {
    if (floatingOnImage) {
      return accentColor ? "text-white" : "text-foreground";
    }
    return showFullBar && blendedColor && isDarkHex(blendedColor)
      ? "text-white"
      : "text-foreground";
  }, [floatingOnImage, accentColor, showFullBar, blendedColor]);

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-20 md:hidden flex items-center gap-1 h-11 transition-all duration-200",
        !showFullBar && "bg-transparent",
        showFullBar &&
          !accentColor &&
          "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        showFullBar && accentColor && "backdrop-blur-sm",
        textColorClass,
      )}
      style={{
        paddingTop: "var(--safe-area-top)",
        paddingLeft: "max(0.25rem, var(--safe-area-left))",
        paddingRight: "max(0.25rem, var(--safe-area-right))",
        ...accentBgStyle,
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-11 w-11 p-0 rounded-md flex-shrink-0 z-10 transition-colors",
          floatingOnImage && "text-foreground drop-shadow-md",
          showFullBar && blendedColor && isDarkHex(blendedColor)
            ? "hover-supported:bg-white/20 text-white"
            : "",
          showFullBar && blendedColor && !isDarkHex(blendedColor)
            ? "hover-supported:bg-black/10"
            : "",
        )}
        onClick={handleBack}
        aria-label={t("navigation.back")}
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={2} />
      </Button>
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm font-bold truncate transition-opacity duration-200 block",
            showFullBar ? "opacity-100" : "opacity-0",
          )}
        >
          {title}
        </span>
      </div>
      <div className="pr-2 flex-shrink-0 z-10">
        <MobileHeaderStatusItems extra={actions} />
      </div>
    </div>
  );
}

export function MobilePageHeader({
  variant,
  title,
  className,
  onBack,
  accentColor,
  count,
  actions,
  showSpacer = true,
}: MobilePageHeaderProps) {
  if (variant === "root") {
    return (
      <div
        className={cn("md:hidden px-4 pt-[var(--safe-area-top)]", className)}
      >
        <div className="flex items-center justify-between py-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {count !== undefined && (
              <span className="text-xs text-muted-foreground font-medium">
                {count}
              </span>
            )}
          </div>
          <MobileHeaderStatusItems extra={actions} />
        </div>
      </div>
    );
  }

  return (
    <>
      {showSpacer && (
        <div
          className="h-11 md:hidden"
          style={{ marginTop: "var(--safe-area-top)" }}
        />
      )}
      <StickyHeader
        title={title}
        onBack={onBack}
        accentColor={accentColor}
        actions={actions}
      />
    </>
  );
}

export { DesktopHeaderStatusItems };
