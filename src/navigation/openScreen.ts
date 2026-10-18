import { router } from 'expo-router';
import { createTapGuard } from '../domain/staleRequest';

const allowTap = createTapGuard(700);

/** Drops a repeated tap before it can push the same screen twice. */
export function openScreen(href: string) {
  if (!allowTap(href)) {
    return;
  }
  router.push(href as never);
}
