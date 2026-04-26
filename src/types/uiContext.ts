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
  width: number;
  setWidth: (width: number) => void;
  resetWidth: () => void;
}

interface IRightPanel {
  width: number;
  setWidth: (width: number) => void;
  resetWidth: () => void;
}

export interface IUiContext {
  songInfo: ISongInfo;
  sidebar: ISidebar;
  rightPanel: IRightPanel;
}
