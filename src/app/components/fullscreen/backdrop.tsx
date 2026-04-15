import { useBackdropBg } from "@/app/hooks/use-backdrop-bg";

export function FullscreenBackdrop() {
  return <DynamicColorBackdrop />;
}

function DynamicColorBackdrop() {
  const backgroundColor = useBackdropBg();

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
      <div
        className="w-full h-full transition-[background-color] duration-1000"
        style={{ backgroundColor }}
      />
    </div>
  );
}
