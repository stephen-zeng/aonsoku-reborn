import { useMemo } from "react";
import { DataTableList } from "@/app/components/ui/data-table-list";
import { queueColumns } from "@/app/tables/queue-columns";
import {
  usePlayerActions,
  usePlayerCurrentList,
  usePlayerCurrentSongIndex,
} from "@/store/player.store";
import { ColumnFilter } from "@/types/columnFilter";

export function QueueSongList() {
  const currentList = usePlayerCurrentList();
  const currentSongIndex = usePlayerCurrentSongIndex();
  const { setSongList } = usePlayerActions();

  const columns = useMemo(() => queueColumns(), []);

  const columnsToShow: ColumnFilter[] = [
    "index",
    "title",
    // 'artist',
    "album",
    "duration",
    "remove",
  ];

  return (
    <div className="flex flex-1 flex-col h-full min-w-[300px]">
      <div className="w-full h-full overflow-auto">
        <DataTableList
          data={currentList}
          columns={columns}
          columnFilter={columnsToShow}
          showHeader={false}
          handlePlaySong={(row) => setSongList(currentList, row.index)}
          scrollToIndex={true}
          currentSongIndex={currentSongIndex}
          allowRowSelection={false}
          showContextMenu={false}
          pageType="queue"
        />
      </div>
    </div>
  );
}
