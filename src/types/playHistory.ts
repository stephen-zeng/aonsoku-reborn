import type { ISong } from "./responses/song";

export interface IPlayHistoryActions {
  addToHistory: (song: ISong) => void;
  removeFromHistory: (index: number) => void;
  clearHistory: () => void;
  setMaxSize: (size: number) => void;
}

export interface IPlayHistoryContext {
  history: ISong[];
  maxSize: number;
  actions: IPlayHistoryActions;
}
