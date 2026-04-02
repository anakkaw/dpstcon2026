"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/ui/section-title";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalShell } from "@/components/ui/modal-shell";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { getRoleLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { displayNameTh, displayNameEn } from "@/lib/display-name";
import type { AdminUserData, RegistrationStats } from "@/server/admin-users-data";
import {
  UserPlus, Upload, Search, Pencil, KeyRound, Trash2, X, Send, RefreshCw,
  Users, ShieldCheck, UserCheck, ChevronDown, ChevronUp,
  GraduationCap, Eye, EyeOff, Bell, CheckCircle, Clock, AlertTriangle,
} from "lucide-react";

const ROLE_COLORS: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  ADMIN: "danger", PROGRAM_CHAIR: "info", REVIEWER: "success", COMMITTEE: "warning", AUTHOR: "neutral",
};

const ALL_ROLES = ["ADMIN", "PROGRAM_CHAIR", "REVIEWER", "COMMITTEE", "AUTHOR"] as const;
type RegistrationStatus = "active" | "pending" | "expired";
type StatusFilter = "all" | RegistrationStatus;
type SortBy = "name" | "email" | "affiliation" | "createdAt" | "status";
type SortDir = "asc" | "desc";
type ModalMode = null | "edit" | "password" | "delete";
const STATUS_ORDER: Record<RegistrationStatus, number> = {
  active: 0,
  pending: 1,
  expired: 2,
};

function renderSortIcon(col: SortBy, sortBy: SortBy, sortDir: SortDir) {
  if (sortBy !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function getRegistrationStatus(user: AdminUserData): RegistrationStatus {
  if (user.isActive) return "active";
  if (user.inviteExpiresAt && new Date(user.inviteExpiresAt) > new Date()) return "pending";
  return "expired";
}

export function AdminUsersClient({
  initialUsers,
  initialRegStats,
}: {
  initialUsers: AdminUserData[];
  initialRegStats: RegistrationStats;
}) {
  const { t } = useI18n();
  const roleLabels = getRoleLabels(t);
  const [users, setUsers] = useState<AdminUserData[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "danger">("success");
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "", roles: ["AUTHOR"] as string[], affiliation: "",
    prefixTh: "", prefixEn: "", firstNameTh: "", lastNameTh: "", firstNameEn: "", lastNameEn: "",
  });
  const [creating, setCreating] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [importing, setImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ email: string; status: string }[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserData | null>(null);
  const [editForm, setEditForm] = useState({
    affiliation: "", bio: "", roles: [] as string[],
    prefixTh: "", prefixEn: "", firstNameTh: "", lastNameTh: "", firstNameEn: "", lastNameEn: "",
  });
  const [resetPw, setResetPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regStats, setRegStats] = useState<RegistrationStats>(initialRegStats);
  const [reminding, setReminding] = useState(false);
  const [bulkRemindOpen, setBulkRemindOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function loadUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    return data.users || [];
  }

  async function loadRegStats() {
    try {
      const res = await fetch("/api/users/registration-stats");
      const data = await res.json();
      return data;
    } catch {
      return null;
    }
  }

  async function refreshUsers() {
    const nextUsers = await loadUsers();
    setUsers(nextUsers);
  }

  async function refreshRegStats() {
    const nextStats = await loadRegStats();
    if (nextStats) {
      setRegStats(nextStats);
    }
  }

  async function bulkRemind() {
    setReminding(true);
    try {
      const res = await fetch("/api/users/bulk-remind", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showMsg(t("users.bulkRemindSuccess").replace("{sent}", data.sent).replace("{total}", data.total));
        void refreshUsers();
        void refreshRegStats();
      } else {
        showMsg(data.error || t("users.genericError"), "danger");
      }
    } catch {
      showMsg(t("users.genericError"), "danger");
    }
    setReminding(false);
    setBulkRemindOpen(false);
  }

  function showMsg(text: string, type: "success" | "danger" = "success") {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  }

  function openModal(mode: ModalMode, user: AdminUserData) {
    setSelectedUser(user);
    setModalMode(mode);
    if (mode === "edit") {
      setEditForm({
        affiliation: user.affiliation || "",
        bio: user.bio || "",
        roles: user.roles || [user.role],
        prefixTh: user.prefixTh || "",
        prefixEn: user.prefixEn || "",
        firstNameTh: user.firstNameTh || "",
        lastNameTh: user.lastNameTh || "",
        firstNameEn: user.firstNameEn || "",
        lastNameEn: user.lastNameEn || "",
      });
    }
    if (mode === "password") {
      setResetPw("");
      setShowPw(false);
    }
  }

  function closeModal() {
    setModalMode(null);
    setSelectedUser(null);
  }

  function toggleRole(role: string, current: string[], setter: (roles: string[]) => void) {
    if (current.includes(role)) {
      if (current.length > 1) setter(current.filter((entry) => entry !== role));
    } else {
      setter([...current, role]);
    }
  }

  function toggleSort(col: SortBy) {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  function getStatusLabel(status: RegistrationStatus) {
    if (status === "active") return t("users.statusActive");
    if (status === "pending") return t("users.statusPending");
    return t("users.statusExpired");
  }

  function getStatusTone(status: RegistrationStatus): "success" | "warning" | "danger" {
    if (status === "active") return "success";
    if (status === "pending") return "warning";
    return "danger";
  }

  async function createUser() {
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        showMsg(t("users.invitationSent"));
        setNewUser({
          email: "", roles: ["AUTHOR"], affiliation: "",
          prefixTh: "", prefixEn: "", firstNameTh: "", lastNameTh: "", firstNameEn: "", lastNameEn: "",
        });
        setShowCreate(false);
        void refreshUsers();
        void refreshRegStats();
      } else {
        const data = await res.json();
        showMsg(data.error || t("users.failedToCreate"), "danger");
      }
    } catch {
      showMsg(t("users.genericError"), "danger");
    }
    setCreating(false);
  }

  async function saveEdit() {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliation: editForm.affiliation, bio: editForm.bio,
          prefixTh: editForm.prefixTh, prefixEn: editForm.prefixEn,
          firstNameTh: editForm.firstNameTh, lastNameTh: editForm.lastNameTh,
          firstNameEn: editForm.firstNameEn, lastNameEn: editForm.lastNameEn,
        }),
      });
      const rolesChanged = JSON.stringify(editForm.roles.sort()) !== JSON.stringify((selectedUser.roles || [selectedUser.role]).sort());
      if (rolesChanged) {
        await fetch(`/api/users/${selectedUser.id}/roles`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles: editForm.roles }),
        });
      }
      if (res.ok) {
        showMsg(t("users.changesSaved"));
        closeModal();
        void refreshUsers();
      } else {
        showMsg(t("users.failedToSave"), "danger");
      }
    } catch {
      showMsg(t("users.genericError"), "danger");
    }
    setSaving(false);
  }

  async function resetPassword() {
    if (!selectedUser || !resetPw || resetPw.length < 8) {
      showMsg(t("users.passwordPolicy"), "danger");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPw }),
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(t("users.passwordResetSuccess"));
        closeModal();
      } else {
        showMsg(data.error || t("users.resetFailed"), "danger");
      }
    } catch {
      showMsg(t("users.genericError"), "danger");
    }
    setSaving(false);
  }

  async function deleteUser() {
    if (!selectedUser) return;
    setSaving(true);
    // Use force=true to also delete submissions and all related data
    const res = await fetch(`/api/users/${selectedUser.id}?force=true`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showMsg(t("users.userDeleted"));
      closeModal();
      void refreshUsers();
      void refreshRegStats();
    } else {
      showMsg(data.error || t("users.deleteFailed"), "danger");
    }
    setSaving(false);
  }

  async function resendInvite(userId: string) {
    const res = await fetch(`/api/users/${userId}/resend-invite`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      showMsg(t("users.invitationResent"));
      void refreshUsers();
      void refreshRegStats();
    } else {
      showMsg(data.error || t("users.failedToResend"), "danger");
    }
  }

  async function handleBulkImport() {
    setImporting(true);
    setBulkResults([]);
    try {
      const lines = bulkData.trim().split("\n").filter((line) => line.trim());
      const usersToImport = lines.map((line) => {
        const parts = line.split(",").map((segment) => segment.trim());
        if (parts.length >= 7) {
          const [prefixTh, firstNameTh, lastNameTh, prefixEn, firstNameEn, lastNameEn, email, rolesStr, affiliation] = parts;
          const name = `${prefixTh}${firstNameTh} ${lastNameTh}`;
          const roles = rolesStr ? rolesStr.split("|").map((role) => role.trim()) : ["AUTHOR"];
          return { name, email, roles, affiliation, prefixTh, prefixEn, firstNameTh, lastNameTh, firstNameEn, lastNameEn };
        }
        const [name, email, rolesStr, affiliation] = parts;
        const roles = rolesStr ? rolesStr.split("|").map((role) => role.trim()) : ["AUTHOR"];
        return { name, email, roles, affiliation };
      });
      const res = await fetch("/api/users/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: usersToImport }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResults(data.results || []);
        const summaryKey = (data.inviteFailed || 0) > 0
          ? "users.importSummaryWithFailures"
          : "users.importSummary";
        showMsg(
          t(summaryKey)
            .replace("{invited}", String(data.invited || 0))
            .replace("{inviteFailed}", String(data.inviteFailed || 0))
            .replace("{updated}", String(data.updated || 0)),
          (data.inviteFailed || 0) > 0 ? "danger" : "success"
        );
        void refreshUsers();
        void refreshRegStats();
      } else {
        showMsg(data.error || t("users.importFailed"), "danger");
      }
    } catch {
      showMsg(t("users.genericError"), "danger");
    }
    setImporting(false);
  }

  const roleStats = useMemo(() => {
    return ALL_ROLES.map((role) => ({
      role,
      count: users.filter((entry) => (entry.roles || [entry.role]).includes(role)).length,
    }));
  }, [users]);

  const statusStats = useMemo(
    () => [
      { key: "all" as const, label: t("common.all"), count: users.length },
      { key: "active" as const, label: t("users.statusActive"), count: regStats.active },
      { key: "pending" as const, label: t("users.statusPending"), count: regStats.pending },
      { key: "expired" as const, label: t("users.statusExpired"), count: regStats.expired },
    ],
    [regStats.active, regStats.pending, regStats.expired, t, users.length]
  );

  const filtered = useMemo(() => {
    const result = users.filter((entry) => {
      const query = search.toLowerCase();
      const status = getRegistrationStatus(entry);
      const nameThFull = displayNameTh(entry);
      const nameEnFull = displayNameEn(entry);
      const matchSearch = !search || nameThFull.toLowerCase().includes(query) || nameEnFull.toLowerCase().includes(query) || entry.email.toLowerCase().includes(query) || (entry.affiliation || "").toLowerCase().includes(query);
      const matchRole = !filterRole || (entry.roles || [entry.role]).includes(filterRole);
      const matchStatus = filterStatus === "all" || status === filterStatus;
      return matchSearch && matchRole && matchStatus;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = displayNameTh(a).localeCompare(displayNameTh(b), "th");
      else if (sortBy === "email") cmp = a.email.localeCompare(b.email);
      else if (sortBy === "affiliation") cmp = (a.affiliation || "").localeCompare(b.affiliation || "", "th");
      else if (sortBy === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortBy === "status") cmp = STATUS_ORDER[getRegistrationStatus(a)] - STATUS_ORDER[getRegistrationStatus(b)];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [users, search, filterRole, filterStatus, sortBy, sortDir]);

  return (
    <div className="space-y-6">
      <SectionTitle title={t("users.title")} subtitle={t("users.usersInSystem", { n: users.length })}
        action={<div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkRemindOpen(true)} loading={reminding}><Bell className="h-4 w-4" />{t("users.bulkRemind")}</Button>
          <Button size="sm" variant="outline" onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}><Upload className="h-4 w-4" />{t("users.bulkImport")}</Button>
          <Button size="sm" onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}><UserPlus className="h-4 w-4" />{t("users.inviteUser")}</Button>
        </div>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStatCard label={t("users.statusActive")} value={regStats.active} icon={<CheckCircle className="h-5 w-5" />} color="emerald" />
        <SummaryStatCard label={t("users.statusPending")} value={regStats.pending} icon={<Clock className="h-5 w-5" />} color="amber" />
        <SummaryStatCard label={t("users.statusExpired")} value={regStats.expired} icon={<AlertTriangle className="h-5 w-5" />} color="red" />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusStats.map(({ key, label, count }) => {
          const isActive = filterStatus === key;
          const activeClasses: Record<StatusFilter, string> = {
            all: "bg-slate-200 border-slate-400 text-slate-800",
            active: "bg-emerald-100 border-emerald-400 text-emerald-800",
            pending: "bg-amber-100 border-amber-400 text-amber-800",
            expired: "bg-red-100 border-red-400 text-red-800",
          };
          const inactiveClasses: Record<StatusFilter, string> = {
            all: "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300",
            active: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300",
            pending: "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300",
            expired: "bg-red-50 border-red-200 text-red-700 hover:border-red-300",
          };
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${isActive ? `${activeClasses[key]} ring-2 ring-offset-1 ring-current/20 shadow-sm` : inactiveClasses[key]}`}
            >
              {label}
              <span className={`ml-0.5 text-xs font-bold ${isActive ? "" : "opacity-60"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {roleStats.map(({ role, count }) => {
          const isActive = filterRole === role;
          const iconMap: Record<string, React.ReactNode> = {
            ADMIN: <ShieldCheck className="h-4 w-4" />,
            PROGRAM_CHAIR: <GraduationCap className="h-4 w-4" />,
            REVIEWER: <UserCheck className="h-4 w-4" />,
            COMMITTEE: <Users className="h-4 w-4" />,
            AUTHOR: <Pencil className="h-4 w-4" />,
          };
          const colors: Record<string, { active: string; inactive: string }> = {
            ADMIN: { active: "bg-red-100 border-red-400 text-red-800", inactive: "bg-red-50 border-red-200 text-red-700 hover:border-red-300" },
            PROGRAM_CHAIR: { active: "bg-blue-100 border-blue-400 text-blue-800", inactive: "bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300" },
            REVIEWER: { active: "bg-emerald-100 border-emerald-400 text-emerald-800", inactive: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300" },
            COMMITTEE: { active: "bg-amber-100 border-amber-400 text-amber-800", inactive: "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300" },
            AUTHOR: { active: "bg-gray-200 border-gray-400 text-gray-800", inactive: "bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300" },
          };
          const color = colors[role];
          return (
            <button
              key={role}
              onClick={() => setFilterRole(isActive ? "" : role)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${isActive ? `${color.active} ring-2 ring-offset-1 ring-current/20 shadow-sm` : color.inactive}`}
            >
              {iconMap[role]}
              {roleLabels[role]}
              <span className={`ml-0.5 text-xs font-bold ${isActive ? "" : "opacity-60"}`}>{count}</span>
            </button>
          );
        })}
        {filterRole && (
          <button onClick={() => setFilterRole("")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-ink-muted hover:bg-gray-100 transition-colors">
            <X className="h-3.5 w-3.5" /> {t("common.clear")}
          </button>
        )}
        {filterStatus !== "all" && (
          <button onClick={() => setFilterStatus("all")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-ink-muted hover:bg-gray-100 transition-colors">
            <X className="h-3.5 w-3.5" /> {t("common.clear")} {t("users.status")}
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("users.searchPlaceholder")}
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-8 py-2.5 text-sm text-ink placeholder:text-gray-400 transition-all duration-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {message && <Alert tone={messageType}>{message}</Alert>}

      {showCreate && (
        <Card accent="brand">
          <CardHeader><h3 className="text-sm font-semibold text-ink">{t("users.inviteNewUser")}</h3></CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.thaiInfo")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={t("users.prefixTh")}><Input value={newUser.prefixTh} onChange={(e) => setNewUser({ ...newUser, prefixTh: e.target.value })} placeholder={t("users.prefixThPlaceholder")} /></Field>
              <Field label={t("users.firstNameTh")} required><Input value={newUser.firstNameTh} onChange={(e) => setNewUser({ ...newUser, firstNameTh: e.target.value })} placeholder={t("users.firstNameThPlaceholder")} /></Field>
              <Field label={t("users.lastNameTh")} required><Input value={newUser.lastNameTh} onChange={(e) => setNewUser({ ...newUser, lastNameTh: e.target.value })} placeholder={t("users.lastNameThPlaceholder")} /></Field>
            </div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.englishInfo")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={t("users.prefixEn")}><Input value={newUser.prefixEn} onChange={(e) => setNewUser({ ...newUser, prefixEn: e.target.value })} placeholder={t("users.prefixEnPlaceholder")} /></Field>
              <Field label={t("users.firstNameEn")}><Input value={newUser.firstNameEn} onChange={(e) => setNewUser({ ...newUser, firstNameEn: e.target.value })} placeholder={t("users.firstNameEnPlaceholder")} /></Field>
              <Field label={t("users.lastNameEn")}><Input value={newUser.lastNameEn} onChange={(e) => setNewUser({ ...newUser, lastNameEn: e.target.value })} placeholder={t("users.lastNameEnPlaceholder")} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("users.email")} required><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder={t("users.emailPlaceholder")} /></Field>
              <Field label={t("users.affiliation")}><Input value={newUser.affiliation} onChange={(e) => setNewUser({ ...newUser, affiliation: e.target.value })} placeholder={t("users.affiliationPlaceholder")} /></Field>
            </div>
            <Field label={t("users.roles")}>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role, newUser.roles, (roles) => setNewUser({ ...newUser, roles }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      newUser.roles.includes(role)
                        ? "bg-brand-50 border-brand-300 text-brand-700"
                        : "bg-white border-border text-ink-muted hover:border-brand-200"
                    }`}
                  >
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
            </Field>
            <p className="text-xs text-ink-muted">{t("users.inviteEmailNote")}</p>
          </CardBody>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={createUser} loading={creating} disabled={!newUser.firstNameTh || !newUser.lastNameTh || !newUser.email}>
              <Send className="h-4 w-4" />{t("users.sendInvitation")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {showBulk && (
        <Card accent="info">
          <CardHeader><h3 className="text-sm font-semibold text-ink">{t("users.bulkImportTitle")}</h3></CardHeader>
          <CardBody className="space-y-3">
            <Field label={t("users.csvData")} hint={t("users.csvFormatExtended")}>
              <Textarea value={bulkData} onChange={(e) => setBulkData(e.target.value)} rows={6}
                placeholder={"นาย,สมชาย,ใจดี,Mr.,Somchai,Jaidee,somchai@dpstcon.org,AUTHOR,Mahidol University\nนางสาว,สมหญิง,รักเรียน,Ms.,Somying,Rakrian,somying@dpstcon.org,AUTHOR|REVIEWER,Chulalongkorn University"} />
            </Field>
            {bulkResults.length > 0 && (
              <div className="bg-surface-alt rounded-lg p-3 text-sm">
                <p className="font-medium mb-2">{t("users.importResults")}</p>
                {bulkResults.map((result, index) => (
                  <p key={index} className={result.status === "invited" ? "text-green-700" : result.status === "updated_roles" ? "text-blue-600" : "text-red-600"}>
                    {result.email}: {result.status === "invited"
                      ? t("users.invited")
                      : result.status === "updated_roles"
                        ? t("users.rolesUpdated")
                        : result.status === "invite_failed"
                          ? t("users.inviteFailed")
                          : t("users.failed")}
                  </p>
                ))}
              </div>
            )}
          </CardBody>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowBulk(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={handleBulkImport} loading={importing} disabled={!bulkData.trim()}>{t("users.importAndSend")}</Button>
          </CardFooter>
        </Card>
      )}

      <div className="space-y-3 lg:hidden">
        {filtered.map((entry) => {
          const userRoles = entry.roles || [entry.role];
          const status = getRegistrationStatus(entry);
          const isExpanded = expandedId === entry.id;
          return (
            <Card key={entry.id}>
              <CardBody className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} className="min-w-0 flex-1 text-left">
                    <p className="font-semibold text-ink">{displayNameTh(entry)}</p>
                    {(entry.firstNameEn || entry.lastNameEn) && <p className="mt-0.5 text-xs text-ink-muted">{displayNameEn(entry)}</p>}
                    <p className="mt-1 text-sm text-ink-light">{entry.email}</p>
                  </button>
                  <Badge tone={getStatusTone(status)}>
                    {getStatusLabel(status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {userRoles.map((role) => (
                    <Badge key={role} tone={ROLE_COLORS[role] || "neutral"} className="text-xs">
                      {roleLabels[role] || role}
                    </Badge>
                  ))}
                </div>
                {entry.affiliation && <p className="text-sm text-ink-muted">{entry.affiliation}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openModal("edit", entry)}><Pencil className="h-4 w-4" />{t("users.editAction")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => openModal("password", entry)}><KeyRound className="h-4 w-4" />{t("users.passwordAction")}</Button>
                  {!entry.isActive && <Button size="sm" variant="secondary" onClick={() => resendInvite(entry.id)}><RefreshCw className="h-4 w-4" />{t("users.resendAction")}</Button>}
                  <Button size="sm" variant="danger" onClick={() => openModal("delete", entry)}><Trash2 className="h-4 w-4" />{t("users.deleteAction")}</Button>
                </div>
                {isExpanded && (
                  <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-alt p-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("users.email")}</p>
                      <p className="mt-1 text-ink">{entry.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("users.affiliation")}</p>
                      <p className="mt-1 text-ink">{entry.affiliation || "—"}</p>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="hidden lg:block">
        <CardBody className="hidden p-0 lg:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-surface-alt/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-ink transition-colors">{t("users.name")} {renderSortIcon("name", sortBy, sortDir)}</button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <button onClick={() => toggleSort("email")} className="flex items-center gap-1 hover:text-ink transition-colors">{t("users.email")} {renderSortIcon("email", sortBy, sortDir)}</button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <button onClick={() => toggleSort("affiliation")} className="flex items-center gap-1 hover:text-ink transition-colors">{t("users.affiliation")} {renderSortIcon("affiliation", sortBy, sortDir)}</button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-ink transition-colors">{t("users.status")} {renderSortIcon("status", sortBy, sortDir)}</button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.roles")}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider w-32">{t("users.actionsCol")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const userRoles = entry.roles || [entry.role];
                  const status = getRegistrationStatus(entry);
                  return (
                    <tr key={entry.id} className="border-b border-border/40 hover:bg-surface-hover/50 transition-colors group">
                      <td className="px-4 py-3">
                        <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="text-left w-full group/name">
                          <div className="font-medium text-ink group-hover/name:text-brand-600 transition-colors">{displayNameTh(entry)}</div>
                          {(entry.firstNameEn || entry.lastNameEn) && <div className="text-xs text-ink-muted">{displayNameEn(entry)}</div>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-ink-light">{entry.email}</td>
                      <td className="px-4 py-3 text-ink-light">{entry.affiliation || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={getStatusTone(status)}>
                          {getStatusLabel(status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.map((role) => (
                            <Badge key={role} tone={ROLE_COLORS[role] || "neutral"} className="text-xs">
                              {roleLabels[role] || role}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => openModal("edit", entry)} className="p-1.5 rounded-lg text-ink-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title={t("users.editAction")}><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => openModal("password", entry)} className="p-1.5 rounded-lg text-ink-muted hover:text-yellow-600 hover:bg-yellow-50 transition-colors" title={t("users.passwordAction")}><KeyRound className="h-4 w-4" /></button>
                          {!entry.isActive && <button onClick={() => resendInvite(entry.id)} className="p-1.5 rounded-lg text-ink-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title={t("users.resendAction")}><RefreshCw className="h-4 w-4" /></button>}
                          <button onClick={() => openModal("delete", entry)} className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-red-50 transition-colors" title={t("users.deleteAction")}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
        {filtered.length > 0 && <CardFooter className="text-xs text-ink-muted">{t("users.showingUsers", { n: filtered.length, total: users.length })}</CardFooter>}
      </Card>

      {filtered.length === 0 && <EmptyState icon={<Search className="h-14 w-14" />} title={t("users.noUsersFound")} body={t("users.adjustSearch")} />}

      {modalMode === "edit" && selectedUser && (
        <ModalShell open title={t("users.editUser")} description={selectedUser.email} onClose={closeModal} footer={<div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={closeModal}>{t("common.cancel")}</Button><Button size="sm" onClick={saveEdit} loading={saving}>{t("users.saveChanges")}</Button></div>}>
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("users.thaiInfo")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("users.prefixTh")}><Input value={editForm.prefixTh} onChange={(e) => setEditForm({ ...editForm, prefixTh: e.target.value })} placeholder={t("users.prefixThPlaceholder")} /></Field>
              <Field label={t("users.firstNameTh")}><Input value={editForm.firstNameTh} onChange={(e) => setEditForm({ ...editForm, firstNameTh: e.target.value })} placeholder={t("users.firstNameThPlaceholder")} /></Field>
              <Field label={t("users.lastNameTh")}><Input value={editForm.lastNameTh} onChange={(e) => setEditForm({ ...editForm, lastNameTh: e.target.value })} placeholder={t("users.lastNameThPlaceholder")} /></Field>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("users.englishInfo")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("users.prefixEn")}><Input value={editForm.prefixEn} onChange={(e) => setEditForm({ ...editForm, prefixEn: e.target.value })} placeholder={t("users.prefixEnPlaceholder")} /></Field>
              <Field label={t("users.firstNameEn")}><Input value={editForm.firstNameEn} onChange={(e) => setEditForm({ ...editForm, firstNameEn: e.target.value })} placeholder={t("users.firstNameEnPlaceholder")} /></Field>
              <Field label={t("users.lastNameEn")}><Input value={editForm.lastNameEn} onChange={(e) => setEditForm({ ...editForm, lastNameEn: e.target.value })} placeholder={t("users.lastNameEnPlaceholder")} /></Field>
            </div>
            <Field label={t("users.affiliation")}><Input value={editForm.affiliation} onChange={(e) => setEditForm({ ...editForm, affiliation: e.target.value })} placeholder={t("users.affiliationPlaceholder")} /></Field>
            <Field label={t("users.roles")}>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role, editForm.roles, (roles) => setEditForm({ ...editForm, roles }))}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      editForm.roles.includes(role)
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-border bg-white text-ink-muted hover:border-brand-200"
                    }`}
                  >
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t("users.bioNotes")}><Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} placeholder={t("users.bioPlaceholder")} /></Field>
          </div>
        </ModalShell>
      )}

      {modalMode === "password" && selectedUser && (
        <ModalShell open title={t("users.passwordTitle")} description={`${displayNameTh(selectedUser)} — ${selectedUser.email}`} onClose={closeModal} footer={<div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={closeModal}>{t("common.cancel")}</Button><Button size="sm" onClick={resetPassword} loading={saving} disabled={!resetPw || resetPw.length < 8}>{t("users.resetPassword")}</Button></div>}>
          <div className="space-y-4">
            <Field label={t("users.newPassword")} hint={t("users.minPasswordLength")} required>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder={t("users.newPasswordPlaceholder")} autoFocus className="pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-ink-muted hover:text-ink">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </Field>
            {resetPw && resetPw.length < 8 && <p className="text-xs text-danger">{t("users.passwordLengthRemaining", { n: 8 - resetPw.length })}</p>}
          </div>
        </ModalShell>
      )}

      {modalMode === "delete" && selectedUser && (
        <ModalShell open title={t("users.deleteTitle")} onClose={closeModal} footer={<div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={closeModal}>{t("common.cancel")}</Button><Button variant="danger" size="sm" onClick={deleteUser} loading={saving}>{t("users.confirmDelete")}</Button></div>}>
          <div className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100"><Trash2 className="h-6 w-6 text-danger" /></div>
            <div>
              <p className="text-base font-semibold text-ink">{displayNameTh(selectedUser)}</p>
              <p className="text-sm text-ink-muted">{selectedUser.email}{selectedUser.affiliation ? ` · ${selectedUser.affiliation}` : ""}</p>
              <p className="mt-2 text-sm font-medium text-danger">{t("users.deleteConfirm")}</p>
            </div>
          </div>
        </ModalShell>
      )}

      <ConfirmDialog
        open={bulkRemindOpen}
        title={t("users.bulkRemindTitle")}
        description={t("users.bulkRemindConfirm")}
        confirmLabel={t("users.bulkRemind")}
        cancelLabel={t("common.cancel")}
        loading={reminding}
        onCancel={() => {
          if (!reminding) {
            setBulkRemindOpen(false);
          }
        }}
        onConfirm={() => {
          void bulkRemind();
        }}
      />
    </div>
  );
}
