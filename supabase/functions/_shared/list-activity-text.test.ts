import { assertEquals } from 'jsr:@std/assert@^1';
import { listActivityText } from './list-activity-text.ts';

// Twin of apps/mobile/src/features/activity/list-activity-text.test.ts.

const added = (...item_names: string[]) =>
  listActivityText({ kind: 'items_added', actor_name: 'Anna', item_names });
const bought = (...item_names: string[]) =>
  listActivityText({ kind: 'items_bought', actor_name: 'Anna', item_names });

Deno.test('added names up to three items, then counts the rest', () => {
  assertEquals(added('Milk'), { title: 'Added to the List', body: 'Milk · Anna' });
  assertEquals(added('Milk', 'eggs', 'lemons').body, 'Milk, eggs, lemons · Anna');
  assertEquals(added('Milk', 'eggs', 'lemons', 'oats', 'rice').body, 'Milk, eggs, lemons +2 · Anna');
});

Deno.test('bought counts the items', () => {
  assertEquals(bought('Milk'), { title: 'Shopping done', body: '1 item bought · Anna' });
  assertEquals(bought('Milk', 'eggs').body, '2 items bought · Anna');
});
