import { useAppStore } from "@/store/app.store";

export async function checkConfiguredServerConnectivity(): Promise<boolean> {
  const { selectConfiguredServer } = useAppStore.getState().actions;

  return selectConfiguredServer();
}
