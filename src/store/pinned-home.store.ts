import merge from "lodash/merge";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { createNativeStorage } from "@/store/native-storage";
import {
  type PinnedHomeContext,
  type PinnedHomeItem,
} from "@/types/pinnedHome";

const STORE_NAME = "pinned_home_store";

function isSamePinnedItem(left: PinnedHomeItem, right: PinnedHomeItem) {
  return left.id === right.id && left.type === right.type;
}

export const usePinnedHomeStore = createWithEqualityFn<PinnedHomeContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set, get) => ({
          items: [],
          actions: {
            pin: (item) => {
              set((state) => {
                if (
                  state.items.some((current) => isSamePinnedItem(current, item))
                ) {
                  return;
                }

                state.items.unshift(item);
              });
            },
            unpin: (item) => {
              set((state) => {
                state.items = state.items.filter(
                  (current) => !isSamePinnedItem(current, item),
                );
              });
            },
            toggle: (item) => {
              const isPinned = get().actions.isPinned(item);

              if (isPinned) {
                get().actions.unpin(item);
                return;
              }

              get().actions.pin(item);
            },
            isPinned: (item) =>
              get().items.some((current) => isSamePinnedItem(current, item)),
          },
        })),
        { name: STORE_NAME },
      ),
      {
        name: STORE_NAME,
        version: 1,
        storage: createNativeStorage<PinnedHomeContext>(STORE_NAME),
        merge: (persistedState, currentState) =>
          merge(currentState, persistedState),
        partialize: (state) => ({
          items: state.items,
        }),
      },
    ),
  ),
  shallow,
);

export const usePinnedHomeItems = () =>
  usePinnedHomeStore((state) => state.items, shallow);

export const usePinnedHomeActions = () =>
  usePinnedHomeStore((state) => state.actions, shallow);

export const useIsPinnedHomeItem = (item: PinnedHomeItem) =>
  usePinnedHomeStore((state) =>
    state.items.some(
      (current) => current.id === item.id && current.type === item.type,
    ),
  );
