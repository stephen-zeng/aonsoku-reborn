export type PinnedHomeItemType = "album" | "playlist";

export interface PinnedHomeItem {
  id: string;
  type: PinnedHomeItemType;
}

export interface PinnedHomeActions {
  pin: (item: PinnedHomeItem) => void;
  unpin: (item: PinnedHomeItem) => void;
  toggle: (item: PinnedHomeItem) => void;
  isPinned: (item: PinnedHomeItem) => boolean;
}

export interface PinnedHomeContext {
  items: PinnedHomeItem[];
  actions: PinnedHomeActions;
}
