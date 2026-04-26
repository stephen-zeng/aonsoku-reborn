import { httpClient } from "@/api/httpClient";
import { Genre, GenresResponse } from "@/types/responses/genre";

async function get(): Promise<Genre[]> {
  const response = await httpClient<GenresResponse>("/getGenres", {
    method: "GET",
  });

  return response.data.genres.genre;
}

export const genres = {
  get,
};
