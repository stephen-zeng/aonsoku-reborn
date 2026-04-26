import clsx from "clsx";
import { type RefAttributes } from "react";
import { Link, LinkProps } from "react-router-dom";
import { Dot } from "@/app/components/dot";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/routesList";
import { IFeaturedArtist } from "@/types/responses/artist";
import { TABLE_ARTISTS_MAX_NUMBER } from "@/utils/multipleArtists";

export type LinkWithoutTo = Omit<LinkProps, "to"> &
  RefAttributes<HTMLAnchorElement>;

type ArtistLinkProps = LinkWithoutTo & {
  artistId?: string;
  disableNavigation?: boolean;
};

export function ArtistLink({
  artistId,
  className,
  disableNavigation = false,
  onContextMenu,
  ...props
}: ArtistLinkProps) {
  if (disableNavigation || !artistId) {
    return (
      <span className={cn("truncate", className)} onClick={props.onClick} title={props.title}>
        {props.children}
      </span>
    );
  }

  return (
    <Link
      className={cn("truncate hover:underline", className)}
      {...props}
      to={ROUTES.ARTIST.PAGE(artistId)}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onContextMenu?.(e);
      }}
    />
  );
}

type ArtistsLinksProps = {
  artists: IFeaturedArtist[];
  onClickLink?: () => void;
  disableNavigation?: boolean;
  className?: string;
  linkClassName?: string;
  linkTestId?: string;
};

export function ArtistsLinks({
  artists,
  onClickLink,
  disableNavigation = false,
  className,
  linkClassName,
  linkTestId,
}: ArtistsLinksProps) {
  const data = artists.slice(0, TABLE_ARTISTS_MAX_NUMBER);
  const showThreeDots = artists.length > TABLE_ARTISTS_MAX_NUMBER;

  function showDot(index: number) {
    return index < artists.length - 1;
  }

  function showTitle(index: number, name: string) {
    return index > 0 ? name : undefined;
  }

  return (
    <div className={cn("flex items-center truncate", className)}>
      {data.map(({ id, name }, index) => (
        <div
          key={id}
          className={clsx("flex items-center", index > 0 && "truncate")}
        >
          <ArtistLink
            artistId={id}
            disableNavigation={disableNavigation}
            className={linkClassName}
            data-testid={linkTestId}
            title={showTitle(index, name)}
            onClick={() => {
              if (onClickLink) onClickLink();
            }}
          >
            {name}
          </ArtistLink>
          {showDot(index) && <Dot />}
        </div>
      ))}
      {showThreeDots && <span>...</span>}
    </div>
  );
}
