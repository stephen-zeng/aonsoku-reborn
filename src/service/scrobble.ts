import { httpClient } from "@/api/httpClient";
import { assertOnlineAccess } from "@/lib/offline/read-model";
import { SubsonicResponse } from "@/types/responses/subsonicResponse";
import dateTime from "@/utils/dateTime";

async function send(id: string, submission: boolean = true) {
  assertOnlineAccess();
  await httpClient<SubsonicResponse>("/scrobble", {
    method: "GET",
    query: {
      id,
      submission: submission ? "true" : "false",
      time: dateTime().valueOf().toString(),
    },
  });
}

export const scrobble = {
  send,
};
