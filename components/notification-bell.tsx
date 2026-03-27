"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
}

/** H12: Validate linkUrl is a safe internal path */
function isSafeUrl(url: string): boolean {
  // Only allow relative paths starting with /
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  // Allow same-origin absolute URLs
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // M16: Only poll when tab is visible
  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      return data.notifications || [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void loadNotifications().then((nextNotifications) => {
      if (mounted) {
        setNotifications(nextNotifications);
      }
    });

    let interval: ReturnType<typeof setInterval>;

    function startPolling() {
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          void loadNotifications().then((nextNotifications) => {
            if (mounted) {
              setNotifications(nextNotifications);
            }
          });
        }
      }, 30000);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void loadNotifications().then((nextNotifications) => {
          if (mounted) {
            setNotifications(nextNotifications);
          }
        });
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // H14: Close on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) markRead(n.id);
    setOpen(false);
    if (n.linkUrl && isSafeUrl(n.linkUrl)) {
      router.push(n.linkUrl);
    }
  }

  return (
    <div className="relative" ref={ref}>
      {/* H14: Accessible button with aria-label and aria-expanded */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={`${t("notifications.title")}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "relative p-2 rounded-xl transition-all duration-200",
          "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
          open && "bg-gray-100 text-gray-600"
        )}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("notifications.list")}
          className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden animate-slide-down"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-ink">{t("notifications.title")}</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">{t("notifications.empty")}</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  role="menuitem"
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full text-left px-5 py-3.5 border-b border-gray-50 cursor-pointer transition-colors duration-150",
                    "hover:bg-gray-50 focus:bg-gray-50 focus:outline-none",
                    !n.isRead && "bg-brand-50/60"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.isRead && (
                      <span className="mt-2 h-2 w-2 rounded-full bg-brand-500 shrink-0" aria-hidden="true" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
