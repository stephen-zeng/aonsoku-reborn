import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
}

function DesktopHeaderStatusItems() {
  return <UserDropdown />;
}

function MobileHeaderStatusItems() {
  return <UserDropdown />;
}

function StickyHeader({
  title,
  onBack,
  accentColor,
}: {
  title: string;
  onBack?: () => void;
  accentColor?: string;
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

  const textColorClass = floatingOnImage
    ? "text-white"
    : showFullBar && blendedColor && isDarkHex(blendedColor)
      ? "text-white"
      : "text-foreground";

  return (
    <>
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
            "h-11 w-11 p-0 rounded-md flex-shrink-0",
            floatingOnImage && "hover:bg-white/20 text-white drop-shadow-md",
            showFullBar && blendedColor && isDarkHex(blendedColor)
              ? "hover:bg-white/20 text-white"
              : "",
            showFullBar && blendedColor && !isDarkHex(blendedColor)
              ? "hover:bg-black/10"
              : "",
          )}
          onClick={handleBack}
          aria-label={t("navigation.back")}
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
        </Button>
        <span
          className={cn(
            "flex-1 text-sm font-medium truncate px-2 transition-opacity duration-200",
            showFullBar ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
          )}
        >
          {title}
        </span>
      </div>
    </>
  );
}

export function MobilePageHeader({
  variant,
  title,
  className,
  onBack,
  accentColor,
}: MobilePageHeaderProps) {
  if (variant === "root") {
    return (
      <div
        className={cn("md:hidden px-4 pt-[var(--safe-area-top)]", className)}
      >
        <div className="flex items-center justify-between py-4">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <div className="flex items-center gap-1">
            <MobileHeaderStatusItems />
          </div>
        </div>
      </div>
    );
  }

  return (
    <StickyHeader title={title} onBack={onBack} accentColor={accentColor} />
  );
}

export { DesktopHeaderStatusItems };
