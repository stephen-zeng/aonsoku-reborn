import { SlidersHorizontal } from "lucide-react";
import { ComponentPropsWithoutRef, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Separator } from "@/app/components/ui/separator";
import { Slider } from "@/app/components/ui/slider";
import { cn } from "@/lib/utils";
import { useSongColor } from "@/store/player.store";

export function FullscreenSettings() {
  return (
    <DynamicSettingsPopover>
      <ColorIntensityOption showSeparator={false} />
    </DynamicSettingsPopover>
  );
}

interface PopoverProps {
  children: ReactNode;
}

function DynamicSettingsPopover({ children }: PopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full hover:bg-foreground/20 data-[state=open]:bg-foreground/20"
          aria-label={t("settings.label")}
        >
          <SlidersHorizontal className="size-4" strokeWidth={2.5} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex flex-col">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

type OptionProps = Omit<
  ComponentPropsWithoutRef<typeof SettingWrapper>,
  "text"
>;

function ColorIntensityOption(props: OptionProps) {
  const { t } = useTranslation();
  const { currentSongColorIntensity, setCurrentSongIntensity } = useSongColor();

  return (
    <SettingWrapper
      text={t("settings.appearance.colors.queue.intensity")}
      {...props}
    >
      <Slider
        defaultValue={[currentSongColorIntensity]}
        min={0.3}
        max={1.0}
        step={0.05}
        onValueChange={([value]) => setCurrentSongIntensity(value)}
      />
    </SettingWrapper>
  );
}

type SettingWrapperProps = ComponentPropsWithoutRef<"div"> & {
  text: string;
  showSeparator?: boolean;
};

function SettingWrapper({
  text,
  className,
  children,
  showSeparator = true,
  ...props
}: SettingWrapperProps) {
  return (
    <>
      {showSeparator && <Separator />}
      <div
        className={cn("flex items-center justify-between p-3", className)}
        {...props}
      >
        <span className="text-sm flex-1 text-balance">{text}</span>
        <div className="w-2/5 flex items-center justify-end">{children}</div>
      </div>
    </>
  );
}
