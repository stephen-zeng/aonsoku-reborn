import { RadioIcon } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Radio } from "@/types/responses/radios";

export function RadioInfo({ radio }: { radio: Radio | undefined }) {
  const { t } = useTranslation();

  return (
    <Fragment>
      <div className="w-12 h-12 md:w-[70px] md:h-[70px] flex justify-center items-center bg-foreground/20 rounded">
        <RadioIcon
          className="w-7 h-7 md:w-12 md:h-12"
          strokeWidth={1}
          data-testid="radio-icon"
        />
      </div>
      <div className="flex flex-col justify-center">
        {radio ? (
          <Fragment>
            <span
              className="text-xs md:text-sm font-medium"
              data-testid="radio-name"
            >
              {radio.name}
            </span>
            <span
              className="text-[10px] md:text-xs font-light text-muted-foreground"
              data-testid="radio-label"
            >
              {t("radios.label")}
            </span>
          </Fragment>
        ) : (
          <span
            className="text-xs md:text-sm font-medium"
            data-testid="radio-no-playing"
          >
            {t("player.noRadioPlaying")}
          </span>
        )}
      </div>
    </Fragment>
  );
}
