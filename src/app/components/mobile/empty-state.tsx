import { type ReactNode } from "react";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";

interface MobileEmptyStateProps {
  title: string;
  headerTitle: string;
  description?: string;
  icon?: ReactNode;
}

export function MobileEmptyState({
  title,
  headerTitle,
  description,
  icon,
}: MobileEmptyStateProps) {
  return (
    <div className="w-full h-full flex flex-col">
      <MobilePageHeader variant="sub" title={headerTitle} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
