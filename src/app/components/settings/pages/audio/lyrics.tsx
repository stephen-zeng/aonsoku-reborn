import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  Content,
  ContentItem,
  ContentItemForm,
  ContentItemTitle,
  ContentSeparator,
  Header,
  HeaderDescription,
  HeaderTitle,
  Root,
} from "@/app/components/settings/section";
import { Input } from "@/app/components/ui/input";
import { Switch } from "@/app/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLyricsSettings } from "@/store/player.store";
import type { LyricsSource } from "@/types/playerContext";
import { isValidServerUrl, normalizeServerUrl } from "@/utils/serverUrl";

export function LyricsSettings() {
  const { t } = useTranslation();
  const {
    preferSyncedLyrics,
    setPreferSyncedLyrics,
    showTranslation,
    setShowTranslation,
    sourcePriority,
    setSourcePriority,
    customServerEnabled,
    setCustomServerEnabled,
    customServerUrl,
    setCustomServerUrl,
    customServerPassword,
    setCustomServerPassword,
  } = useLyricsSettings();
  const [urlValue, setUrlValue] = useState(customServerUrl);
  const [passwordValue, setPasswordValue] = useState(customServerPassword);

  useEffect(() => {
    setUrlValue(customServerUrl);
  }, [customServerUrl]);

  useEffect(() => {
    setPasswordValue(customServerPassword);
  }, [customServerPassword]);

  function handleCustomServerUrlBlur() {
    const normalizedUrl = normalizeServerUrl(urlValue);

    if (normalizedUrl && !isValidServerUrl(normalizedUrl)) {
      toast.error(t("settings.audio.lyrics.customServer.url.invalid"));
      return;
    }

    setUrlValue(normalizedUrl);
    setCustomServerUrl(normalizedUrl);
  }

  function handleCustomServerPasswordBlur() {
    setCustomServerPassword(passwordValue);
  }

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.audio.lyrics.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.audio.lyrics.description")}
        </HeaderDescription>
      </Header>
      <Content>
        <ContentItem>
          <ContentItemTitle info={t("settings.audio.lyrics.preferSynced.info")}>
            {t("settings.audio.lyrics.preferSynced.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={preferSyncedLyrics}
              onCheckedChange={setPreferSyncedLyrics}
            />
          </ContentItemForm>
        </ContentItem>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.audio.lyrics.showTranslation.info")}
          >
            {t("settings.audio.lyrics.showTranslation.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={showTranslation}
              onCheckedChange={setShowTranslation}
            />
          </ContentItemForm>
        </ContentItem>
        <ContentItem>
          <ContentItemTitle info={t("settings.audio.lyrics.source.info")}>
            {t("settings.audio.lyrics.source.label")}
          </ContentItemTitle>
          <ContentItemForm className="max-w-none w-4/5 flex-col items-end gap-1">
            <LyricsSourcePriorityList
              sourcePriority={sourcePriority}
              setSourcePriority={setSourcePriority}
            />
          </ContentItemForm>
        </ContentItem>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.audio.lyrics.customServer.enabled.info")}
          >
            {t("settings.audio.lyrics.customServer.enabled.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={customServerEnabled}
              onCheckedChange={setCustomServerEnabled}
            />
          </ContentItemForm>
        </ContentItem>
        <ContentItem className="items-start gap-4">
          <ContentItemTitle
            info={t("settings.audio.lyrics.customServer.url.info")}
          >
            {t("settings.audio.lyrics.customServer.url.label")}
          </ContentItemTitle>
          <ContentItemForm className="max-w-none w-4/5">
            <Input
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
              onBlur={handleCustomServerUrlBlur}
              placeholder={t(
                "settings.audio.lyrics.customServer.url.placeholder",
              )}
              autoCorrect="false"
              autoCapitalize="false"
              spellCheck="false"
            />
          </ContentItemForm>
        </ContentItem>
        <ContentItem className="items-start gap-4">
          <ContentItemTitle
            info={t("settings.audio.lyrics.customServer.password.info")}
          >
            {t("settings.audio.lyrics.customServer.password.label")}
          </ContentItemTitle>
          <ContentItemForm className="max-w-none w-4/5">
            <Input
              type="password"
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
              onBlur={handleCustomServerPasswordBlur}
              placeholder={t(
                "settings.audio.lyrics.customServer.password.placeholder",
              )}
              autoCorrect="false"
              autoCapitalize="false"
              spellCheck="false"
            />
          </ContentItemForm>
        </ContentItem>
      </Content>
      <ContentSeparator />
    </Root>
  );
}

interface LyricsSourcePriorityListProps {
  sourcePriority: LyricsSource[];
  setSourcePriority: (value: LyricsSource[]) => void;
}

function LyricsSourcePriorityList({
  sourcePriority,
  setSourcePriority,
}: LyricsSourcePriorityListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sourcePriority.indexOf(active.id as LyricsSource);
    const newIndex = sourcePriority.indexOf(over.id as LyricsSource);
    if (oldIndex === -1 || newIndex === -1) return;

    setSourcePriority(arrayMove(sourcePriority, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sourcePriority}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex w-full flex-col gap-2">
          {sourcePriority.map((source, index) => (
            <SortableLyricsSourceItem
              key={source}
              source={source}
              priority={index + 1}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableLyricsSourceItemProps {
  source: LyricsSource;
  priority: number;
}

function SortableLyricsSourceItem({
  source,
  priority,
}: SortableLyricsSourceItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: source });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md border bg-background px-2 text-sm shadow-sm",
        isDragging && "z-10 opacity-60",
      )}
      {...attributes}
    >
      <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
        {priority}.
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {t("settings.audio.lyrics.source." + source)}
      </span>
      <button
        type="button"
        className="-mr-1 rounded p-1 text-muted-foreground cursor-grab touch-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={t("settings.audio.lyrics.source.dragHandle", {
          source: t("settings.audio.lyrics.source." + source),
        })}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
