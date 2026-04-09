import { httpClient } from "@/api/httpClient";
import { assertOnlineAccess } from "@/lib/offline/read-model";
import { SubsonicResponse } from "@/types/responses/subsonicResponse";

async function starItem(id: string) {
  assertOnlineAccess();
  await httpClient<SubsonicResponse>("/star", {
    method: "GET",
    query: {
      id,
    },
  });
}

async function unstarItem(id: string) {
  assertOnlineAccess();
  await httpClient<SubsonicResponse>("/unstar", {
    method: "GET",
    query: {
      id,
    },
  });
}

interface HandleStarItem {
  id: string;
  starred: boolean;
}

async function handleStarItem({ id, starred }: HandleStarItem) {
  if (starred) {
    await unstarItem(id);
  } else {
    await starItem(id);
  }
}

export const star = {
  starItem,
  unstarItem,
  handleStarItem,
};
