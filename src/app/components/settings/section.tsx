import { InfoIcon } from "lucide-react";
import { ComponentPropsWithoutRef, ReactNode } from "react";
import { Separator } from "@/app/components/ui/separator";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { cn } from "@/lib/utils";

type SectionComponent = ComponentPropsWithoutRef<"div">;

export function Root({ children, className, ...props }: SectionComponent) {
  return (
    <div className={cn("w-full", className)} {...props}>
      {children}
    </div>
  );
}

export function Header({ children, className, ...props }: SectionComponent) {
  return (
    <div className={cn("w-full mb-4 space-y-2", className)} {...props}>
      {children}
    </div>
  );
}

export function HeaderTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-medium leading-none text-foreground">{children}</h3>
  );
}

export function HeaderDescription({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function Content({ children, className, ...props }: SectionComponent) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {children}
    </div>
  );
}

export function ContentItem({
  children,
  className,
  ...props
}: SectionComponent) {
  return (
    <div
      className={cn("flex min-h-11 items-center gap-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface ContentItemTitleProps extends ComponentPropsWithoutRef<"span"> {
  info?: string;
}

export function ContentItemTitle({
  info,
  className,
  children,
}: ContentItemTitleProps) {
  const hasHover = useHasHover();

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className={cn("text-sm leading-5 text-foreground", className)}>
          {children}
        </span>
        {info && hasHover && (
          <SimpleTooltip text={info} delay={0}>
            <div className="rounded p-1 hover-supported:bg-muted-foreground/20">
              <InfoIcon className="w-3 h-3" />
            </div>
          </SimpleTooltip>
        )}
      </div>
      {info && !hasHover && (
        <span className="text-xs leading-4 text-muted-foreground">{info}</span>
      )}
    </div>
  );
}

export function ContentItemForm({
  children,
  className,
  ...props
}: SectionComponent) {
  return (
    <div
      className={cn(
        "flex min-w-11 items-center justify-end sm:w-2/5 sm:max-w-52",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ContentSeparator() {
  return <Separator className="mt-4" />;
}
