import { useBackdropStyle } from "@/app/hooks/use-backdrop-bg";

export function FullscreenBackdrop() {
  return <DynamicColorBackdrop />;
}

function DynamicColorBackdrop() {
  const backdropStyle = useBackdropStyle();

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
      <div
        className="w-full h-full fullscreen-backdrop-layer"
        style={backdropStyle}
      />
    </div>
  );
}
