import clsx from "clsx";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import useNavigationHistory from "@/app/hooks/use-navigation-history";

export function NavigationButtons() {
  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory();

  return (
    <div className="flex gap-1">
      <div className={clsx("w-8 h-8", !canGoBack && "cursor-not-allowed")}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-md"
          disabled={!canGoBack}
          onClick={goBack}
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </Button>
      </div>
      <div
        className={clsx(
          "w-8 h-8 hidden md:block",
          !canGoForward && "cursor-not-allowed",
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-md"
          disabled={!canGoForward}
          onClick={goForward}
        >
          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}
