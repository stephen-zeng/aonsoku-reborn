import { httpClient } from "@/api/httpClient";
import type { GetUserResponse, IUser } from "@/types/responses/user";

async function getUser(username: string): Promise<IUser | null> {
  try {
    const response = await httpClient<GetUserResponse>("/getUser", {
      method: "GET",
      query: { username },
    });
    return response.data.user ?? null;
  } catch {
    return null;
  }
}

export const user = { getUser };