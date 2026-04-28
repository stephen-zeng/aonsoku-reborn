import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { SyncProgressBar } from "@/app/components/header/sync-progress-bar";
import { UserDropdown } from "@/app/components/header/user-dropdown";
import { OfflineIndicator } from "@/app/components/offline-indicator";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

type MobilePageHeaderVariant = "root" | "sub";

interface MobilePageHeaderProps {
  variant: MobilePageHeaderVariant;
  title: string;
  className?: string;
  onBack?: () => void;
}

function HeaderStatusItems() {
  return (
    <>
      <OfflineIndicator />
      <SyncProgressBar />
      <UserDropdown />
    </>
  );
}

function StickyHeader({
  title,
  onBack,
}: { title: string; onBack?: () => void }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }

  return (
    <>
      <div ref={sentinelRef} className="h-0 md:hidden" />
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-20 md:hidden flex items-center gap-1 h-11 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b transition-opacity duration-200",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{
          paddingTop: "var(--safe-area-top)",
          paddingLeft: "max(0.25rem, var(--safe-area-left))",
          paddingRight: "max(0.25rem, var(--safe-area-right))",
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0 rounded-md flex-shrink-0"
          onClick={handleBack}
          aria-label={t("navigation.back")}
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
        </Button>
        <span className="flex-1 text-sm font-medium truncate px-2">
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
}: MobilePageHeaderProps) {
  if (variant === "root") {
    return (
      <div
        className={cn("md:hidden px-4 pt-[var(--safe-area-top)]", className)}
      >
        <div className="flex items-center justify-between py-4">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <div className="flex items-center gap-1">
            <HeaderStatusItems />
          </div>
        </div>
      </div>
    );
  }

  return <StickyHeader title={title} onBack={onBack} />;
}

export { HeaderStatusItems };