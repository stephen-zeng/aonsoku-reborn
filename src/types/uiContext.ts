interface ISongInfo {
  songId: string;
  setSongId: (id: string) => void;
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  reset: () => void;
}

interface ISidebar {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
}

export interface IUiContext {
  songInfo: ISongInfo;
  sidebar: ISidebar;
}
