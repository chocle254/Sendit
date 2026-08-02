import { getUserIdFromReq } from "../../../lib/auth";
import { listNotificationsForUser, unreadNotificationCount } from "../../../lib/db";

// Returns notifications and the current unread count without marking them
// read — the frontend calls /api/notifications/read separately once the
// person actually opens the dropdown, so a background poll doesn't silently
// clear the unread badge before they've seen it.
export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const [notifications, unreadCount] = await Promise.all([
    listNotificationsForUser(userId),
    unreadNotificationCount(userId),
  ]);
  res.status(200).json({ notifications, unreadCount });
}
