import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Music2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PLAYER_SEARCH_PARAM } from "@/routes/routesList";
import type { CustomLyricsCandidate } from "@/service/lyrics";
import {
  getCustomLyricsCandidateKey,
  getCustomLyricsSongKey,
  getSelectedCustomLyrics,
} from "@/service/lyrics";
import { subsonic } from "@/service/subsonic";
import { useLyricsSettings, usePlayerSonglist } from "@/store/player.store";
import { queryKeys } from "@/utils/queryKeys";

function getLyricsPreview(lyrics?: string) {
  return lyrics?.trim() || "";
}

type ReturnToLocation = {
  pathname: string;
  search?: string;
};

function getReturnToLocation(state: unknown): ReturnToLocation | null {
  if (typeof state !== "object" || state === null || !("returnTo" in state)) {
    return null;
  }

  const returnTo = state.returnTo;
  if (typeof returnTo !== "object" || returnTo === null) return null;
  if (!("pathname" in returnTo) || typeof returnTo.pathname !== "string") {
    return null;
  }

  return {
    pathname: returnTo.pathname,
    search:
      "search" in returnTo && typeof returnTo.search === "string"
        ? returnTo.search
        : "",
  };
}

export default function CustomLyricsSelect() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSong } = usePlayerSonglist();
  const {
    customServerEnabled,
    customServerUrl,
    selectedCustomLyrics,
    setSelectedCustomLyrics,
  } = useLyricsSettings();

  const { artist, title, album, duration, path } = currentSong || {};
  const songData =
    artist && title ? { artist, title, album, duration, path } : null;
  const songKey = songData ? getCustomLyricsSongKey(songData) : "";
  const selectedLyrics = getSelectedCustomLyrics(selectedCustomLyrics, songKey);
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState({
    title: "",
    artist: "",
  });

  useEffect(() => {
    const nextTitle = title || "";
    const nextArtist = artist || "";

    setSearchTitle(nextTitle);
    setSearchArtist(nextArtist);
    setSubmittedSearch({
      title: nextTitle,
      artist: nextArtist,
    });
  }, [artist, title]);

  const canSearch =
    submittedSearch.title.trim().length > 0 ||
    submittedSearch.artist.trim().length > 0;
  const querySongData =
    songData && canSearch
      ? {
          title: submittedSearch.title.trim() || undefined,
          artist: submittedSearch.artist.trim() || undefined,
        }
      : null;

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: [
      ...queryKeys.lyrics.customCandidates,
      submittedSearch.artist,
      submittedSearch.title,
      customServerEnabled,
      customServerUrl,
    ],
    queryFn: () =>
      querySongData
        ? subsonic.lyrics.getCustomLyricsCandidates(querySongData)
        : Promise.resolve([]),
    enabled:
      !!querySongData &&
      customServerEnabled &&
      customServerUrl.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch({
      title: searchTitle.trim(),
      artist: searchArtist.trim(),
    });
  }

  function returnToFullscreenLyrics() {
    const returnTo = getReturnToLocation(location.state);
    const pathname = returnTo?.pathname || "/";
    const params = new URLSearchParams(returnTo?.search || "");
    params.set(PLAYER_SEARCH_PARAM, "lyrics");

    navigate(
      {
        pathname,
        search: `?${params.toString()}`,
      },
      { replace: true },
    );
  }

  function handleSelect(candidate: CustomLyricsCandidate, index: number) {
    if (!songData) return;
    const candidateKey = getCustomLyricsCandidateKey(candidate, index);
    const lyrics = candidate.lyrics?.trim();
    if (!lyrics) return;

    setSelectedCustomLyrics(songKey, {
      key: candidateKey,
      id: candidate.id,
      title: candidate.title || submittedSearch.title || songData.title,
      artist: candidate.artist || submittedSearch.artist || songData.artist,
      lyrics,
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.lyrics.plain });
    returnToFullscreenLyrics();
  }

  return (
    <div className="w-full px-4 sm:px-8 py-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={returnToFullscreenLyrics}
            aria-label={t("navigation.back")}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {t("lyrics.customSelect.title")}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {currentSong
                ? t("lyrics.customSelect.subtitle", {
                    title: currentSong.title,
                    artist: currentSong.artist,
                  })
                : t("player.noSongPlaying")}
            </p>
          </div>
        </div>

        {currentSong && customServerEnabled && customServerUrl.trim() && (
          <Card>
            <CardContent className="grid gap-4 p-4">
              <form
                className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onSubmit={handleSearch}
              >
                <div className="grid gap-2">
                  <Label htmlFor="custom-lyrics-title">
                    {t("lyrics.customSelect.searchTitle")}
                  </Label>
                  <Input
                    id="custom-lyrics-title"
                    value={searchTitle}
                    onChange={(event) => setSearchTitle(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom-lyrics-artist">
                    {t("lyrics.customSelect.searchArtist")}
                  </Label>
                  <Input
                    id="custom-lyrics-artist"
                    value={searchArtist}
                    onChange={(event) => setSearchArtist(event.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!searchTitle.trim() && !searchArtist.trim()}
                >
                  {t("lyrics.customSelect.search")}
                </Button>
              </form>
              {selectedLyrics && (
                <p className="text-xs text-muted-foreground">
                  {t("lyrics.customSelect.currentSelection", {
                    title: selectedLyrics.title || currentSong.title,
                    artist: selectedLyrics.artist || currentSong.artist,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!currentSong && (
          <EmptyState message={t("lyrics.customSelect.noSong")} />
        )}

        {currentSong && (!customServerEnabled || !customServerUrl.trim()) && (
          <EmptyState message={t("lyrics.customSelect.serverDisabled")} />
        )}

        {currentSong &&
          customServerEnabled &&
          customServerUrl.trim().length > 0 &&
          isLoading && <EmptyState message={t("fullscreen.loadingLyrics")} />}

        {currentSong &&
          customServerEnabled &&
          customServerUrl.trim().length > 0 &&
          !isLoading &&
          candidates.length === 0 && (
            <EmptyState message={t("lyrics.customSelect.empty")} />
          )}

        {candidates.length > 0 && (
          <div className="grid gap-3 pb-6">
            {candidates.map((candidate, index) => {
              const candidateKey = getCustomLyricsCandidateKey(
                candidate,
                index,
              );
              const selected = candidateKey === selectedLyrics?.key;
              const preview = getLyricsPreview(candidate.lyrics);

              return (
                <Card
                  key={candidateKey}
                  className={cn(
                    "transition-colors hover:border-primary/70 hover:bg-accent/40",
                    selected && "border-primary bg-primary/5",
                  )}
                >
                  <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-4">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate text-base">
                        {candidate.title || currentSong.title}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {candidate.artist || currentSong.artist}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant={selected ? "secondary" : "default"}
                      className="shrink-0 gap-1.5"
                      onClick={() => handleSelect(candidate, index)}
                    >
                      {selected && <Check className="size-4" />}
                      {selected
                        ? t("lyrics.customSelect.selected")
                        : t("lyrics.customSelect.select")}
                    </Button>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    {candidate.id && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        {t("lyrics.customSelect.lyricsId", {
                          id: candidate.id,
                        })}
                      </p>
                    )}
                    <ScrollArea
                      type="always"
                      className="h-56 rounded-md border bg-background/40 p-3 overscroll-contain"
                      scrollBarClassName="z-40"
                      onWheel={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                    >
                      <pre className="min-h-60 whitespace-pre-wrap break-words pr-3 font-sans text-sm leading-6 text-foreground/80">
                        {preview || t("lyrics.customSelect.noPreview")}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center text-muted-foreground">
        <Music2 className="size-8" />
        <p>{message}</p>
      </CardContent>
    </Card>
  );
}
