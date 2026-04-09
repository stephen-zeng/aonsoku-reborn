import { httpClient } from "@/api/httpClient";
import { assertOnlineAccess } from "@/lib/offline/read-model";
import {
  CreateRadio,
  Radio,
  RadioStationsResponse,
} from "@/types/responses/radios";
import { SubsonicResponse } from "@/types/responses/subsonicResponse";

async function getAll() {
  const response = await httpClient<RadioStationsResponse>(
    "/getInternetRadioStations",
    {
      method: "GET",
    },
  );

  return response?.data.internetRadioStations.internetRadioStation || [];
}

async function create({ name, streamUrl, homePageUrl }: CreateRadio) {
  assertOnlineAccess();
  await httpClient<SubsonicResponse>("/createInternetRadioStation", {
    method: "POST",
    query: {
      streamUrl,
      name,
      homepageUrl: homePageUrl,
    },
  });
}

async function update({ id, streamUrl, name, homePageUrl = "" }: Radio) {
  assertOnlineAccess();
  await httpClient<SubsonicResponse>("/updateInternetRadioStation", {
    method: "GET",
    query: {
      id,
      streamUrl,
      name,
      homepageUrl: homePageUrl,
    },
  });
}

async function remove(id: string) {
  assertOnlineAccess();
  await httpClient<SubsonicResponse>("/deleteInternetRadioStation", {
    method: "GET",
    query: {
      id,
    },
  });
}

export const radios = {
  getAll,
  create,
  update,
  remove,
};
