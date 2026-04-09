import { httpClient } from "@/api/httpClient";
import { getOfflineGenres } from "@/lib/offline/library-read-model";
import { readOfflineCapable } from "@/lib/offline/read-model";
import { Genre, GenresResponse } from "@/types/responses/genre";

async function get(): Promise<Genre[]> {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<GenresResponse>("/getGenres", {
        method: "GET",
      });

      return response.data.genres.genre;
    },
    () => getOfflineGenres(),
  );
}

export const genres = {
  get,
};
