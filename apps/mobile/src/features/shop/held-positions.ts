export type HeldPosition = {
  itemId: string;
  index: number;
  categoryId: string | null;
  categoryName: string | null;
};

type Row = {
  id: string;
  category_id: string | null;
  category_name: string | null;
};

// A swapped row keeps its old place and category until the screen loses
// focus, so the list only re-sorts on revisit. A shared edit can shift
// indices during the hold; never split a category to honour one.
export function holdPositions<T extends Row>(
  active: readonly T[],
  held: Iterable<HeldPosition>,
): T[] {
  const result = [...active];
  for (const hold of [...held].sort((a, b) => a.index - b.index)) {
    const index = result.findIndex((item) => item.id === hold.itemId);
    if (index === -1) continue;
    const [item] = result.splice(index, 1);
    const first = result.findIndex(
      (row) => row.category_id === hold.categoryId,
    );
    const last = result.findLastIndex(
      (row) => row.category_id === hold.categoryId,
    );
    let position = Math.min(hold.index, result.length);
    if (first !== -1) position = Math.max(first, Math.min(position, last + 1));
    else {
      while (
        position > 0 &&
        position < result.length &&
        result[position]?.category_id === result[position - 1]?.category_id
      )
        position--;
    }
    result.splice(position, 0, {
      ...item!,
      category_id: hold.categoryId,
      category_name: hold.categoryName,
    });
  }
  return result;
}
