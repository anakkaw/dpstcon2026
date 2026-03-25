"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/ui/section-title";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { getRoleLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import {
  UserPlus, Upload, Search, Pencil, KeyRound, Trash2, X, Send, RefreshCw,
  Users, ShieldCheck, UserCheck, ChevronDown, ChevronUp,
  GraduationCap, Eye, EyeOff, Bell, Download, CheckCircle, Clock, AlertTriangle,
} from "lucide-react";

const ROLE_COLORS: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  ADMIN: "danger", PROGRAM_CHAIR: "info", REVIEWER: "success", COMMITTEE: "warning", AUTHOR: "neutral",
};

const ALL_ROLES = ["ADMIN", "PROGRAM_CHAIR", "REVIEWER", "COMMITTEE", "AUTHOR"] as const;

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  affiliation: string | null;
  bio: string | null;
  prefixTh: string | null;
  prefixEn: string | null;
  firstNameTh: string | null;
  lastNameTh: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  isActive: boolean;
  inviteExpiresAt: string | null;
  createdAt: string;
}

interface RegistrationStats {
  total: number;
  active: number;
  pending: number;
  expired: number;
}

type ModalMode = null | "edit" | "password" | "delete";
/** Compose display name from structured fields, fallback to `name` */
function displayNameTh(u: { prefixTh?: string | null; firstNameTh?: string | null; lastNameTh?: string | null; name: string }): string {
  const f = u.firstNameTh || "";
  const l = u.lastNameTh || "";
  if (!f && !l) return u.name;
  const p = u.prefixTh || "";
  return `${p}${f} ${l}`.trim();
}

function displayNameEn(u: { prefixEn?: string | null; firstNameEn?: string | null; lastNameEn?: string | null }): string {
  return [u.prefixEn, u.firstNameEn, u.lastNameEn].filter(Boolean).join(" ");
}

function getInviteStatus(u: UserData): { label: string; tone: "success" | "warning" | "danger" } {
  if (u.isActive) return { label: "Active", tone: "success" };
  if (u.inviteExpiresAt && new Date(u.inviteExpiresAt) > new Date()) return { label: "Pending", tone: "warning" };
  return { label: "Expired", tone: "danger" };
}

export default function AdminUsersPage() {
  const { t, locale } = useI18n();
  const roleLabels = getRoleLabels(t);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "danger">("success");

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "", email: "", roles: ["AUTHOR"] as string[], affiliation: "",
    prefixTh: "", prefixEn: "", firstNameTh: "", lastNameTh: "", firstNameEn: "", lastNameEn: "",
  });
  const [creating, setCreating] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [importing, setImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ email: string; status: string }[]>([]);

  // Modal
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", affiliation: "", bio: "", roles: [] as string[],
    prefixTh: "", prefixEn: "", firstNameTh: "", lastNameTh: "", firstNameEn: "", lastNameEn: "",
  });
  const [resetPw, setResetPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  // Registration stats & bulk remind
  const [regStats, setRegStats] = useState<RegistrationStats | null>(null);
  const [reminding, setReminding] = useState(false);

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort
  const [sortBy, setSortBy] = useState<"name" | "email" | "affiliation" | "createdAt">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => { loadUsers(); loadRegStats(); }, []);

  async function loadUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  async function loadRegStats() {
    try {
      const res = await fetch("/api/users/registration-stats");
      const data = await res.json();
      setRegStats(data);
    } catch { /* ignore */ }
  }

  async function bulkRemind() {
    if (!confirm(t("users.bulkRemindConfirm"))) return;
    setReminding(true);
    try {
      const res = await fetch("/api/users/bulk-remind", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showMsg(t("users.bulkRemindSuccess").replace("{sent}", data.sent).replace("{total}", data.total));
        loadUsers();
        loadRegStats();
      } else {
        showMsg(data.error || "Failed", "danger");
      }
    } catch { showMsg("An error occurred", "danger"); }
    setReminding(false);
  }

  function showMsg(text: string, type: "success" | "danger" = "success") {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  }

  function openModal(mode: ModalMode, user: UserData) {
    setSelectedUser(user);
    setModalMode(mode);
    if (mode === "edit") {
      setEditForm({
        name: user.name,
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
    if (mode === "password") { setResetPw(""); setShowPw(false); }
  }

  function closeModal() { setModalMode(null); setSelectedUser(null); }

  function toggleRole(role: string, current: string[], setter: (roles: string[]) => void) {
    if (current.includes(role)) {
      if (current.length > 1) setter(current.filter((r) => r !== role));
    } else {
      setter([...current, role]);
    }
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
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
        showMsg("Invitation sent successfully");
        setNewUser({
          name: "", email: "", roles: ["AUTHOR"], affiliation: "",
          prefixTh: "", prefixEn: "", firstNameTh: "", lastNameTh: "", firstNameEn: "", lastNameEn: "",
        });
        setShowCreate(false);
        loadUsers();
      } else {
        const d = await res.json();
        showMsg(d.error || "Failed to create user", "danger");
      }
    } catch { showMsg("An error occurred", "danger"); }
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
          name: editForm.name, affiliation: editForm.affiliation, bio: editForm.bio,
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
      if (res.ok) { showMsg("Changes saved"); closeModal(); loadUsers(); }
      else { showMsg("Failed to save", "danger"); }
    } catch { showMsg("An error occurred", "danger"); }
    setSaving(false);
  }

  async function resetPassword() {
    if (!selectedUser || !resetPw || resetPw.length < 8) { showMsg("Password must be at least 8 characters", "danger"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPw }),
      });
      const data = await res.json();
      if (res.ok) { showMsg("Password reset successful"); closeModal(); }
      else { showMsg(data.error || "Reset failed", "danger"); }
    } catch { showMsg("An error occurred", "danger"); }
    setSaving(false);
  }

  async function deleteUser() {
    if (!selectedUser) return;
    setSaving(true);
    const res = await fetch(`/api/users/${selectedUser.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { showMsg("User deleted"); closeModal(); loadUsers(); }
    else { showMsg(data.error || "Delete failed", "danger"); }
    setSaving(false);
  }

  async function resendInvite(userId: string) {
    const res = await fetch(`/api/users/${userId}/resend-invite`, { method: "POST" });
    const data = await res.json();
    if (res.ok) { showMsg("Invitation resent"); loadUsers(); }
    else { showMsg(data.error || "Failed to resend", "danger"); }
  }

  async function handleBulkImport() {
    setImporting(true); setBulkResults([]);
    try {
      const lines = bulkData.trim().split("\n").filter((l) => l.trim());
      const usersToImport = lines.map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        // Support both formats:
        // Extended (9 cols): prefixTh, firstNameTh, lastNameTh, prefixEn, firstNameEn, lastNameEn, email, roles, affiliation
        // Simple (4 cols):   name, email, roles, affiliation
        if (parts.length >= 7) {
          const [prefixTh, firstNameTh, lastNameTh, prefixEn, firstNameEn, lastNameEn, email, rolesStr, affiliation] = parts;
          const name = `${prefixTh}${firstNameTh} ${lastNameTh}`;
          const roles = rolesStr ? rolesStr.split("|").map((r) => r.trim()) : ["AUTHOR"];
          return { name, email, roles, affiliation, prefixTh, prefixEn, firstNameTh, lastNameTh, firstNameEn, lastNameEn };
        }
        const [name, email, rolesStr, affiliation] = parts;
        const roles = rolesStr ? rolesStr.split("|").map((r) => r.trim()) : ["AUTHOR"];
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
        showMsg(`Imported ${data.invited || 0}, updated ${data.updated || 0} users`);
        loadUsers();
      } else { showMsg(data.error || "Import failed", "danger"); }
    } catch { showMsg("An error occurred", "danger"); }
    setImporting(false);
  }

  // Stats by role
  const roleStats = useMemo(() => {
    return ALL_ROLES.map((r) => ({
      role: r,
      count: users.filter((u) => (u.roles || [u.role]).includes(r)).length,
    }));
  }, [users]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let result = users.filter((u) => {
      const q = search.toLowerCase();
      const nameThFull = displayNameTh(u);
      const nameEnFull = displayNameEn(u);
      const matchSearch = !search || nameThFull.toLowerCase().includes(q) || nameEnFull.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.affiliation || "").toLowerCase().includes(q);
      const matchRole = !filterRole || (u.roles || [u.role]).includes(filterRole);
      return matchSearch && matchRole;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = displayNameTh(a).localeCompare(displayNameTh(b), "th");
      else if (sortBy === "email") cmp = a.email.localeCompare(b.email);
      else if (sortBy === "affiliation") cmp = (a.affiliation || "").localeCompare(b.affiliation || "", "th");
      else if (sortBy === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [users, search, filterRole, sortBy, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6">
      <SectionTitle title={t("users.title")} subtitle={t("users.usersInSystem", { n: users.length })}
        action={<div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={bulkRemind} loading={reminding}><Bell className="h-4 w-4" />{t("users.bulkRemind")}</Button>
          <Button size="sm" variant="outline" onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}><Upload className="h-4 w-4" />{t("users.bulkImport")}</Button>
          <Button size="sm" onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}><UserPlus className="h-4 w-4" />{t("users.inviteUser")}</Button>
        </div>}
      />

      {/* Registration Stats */}
      {regStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-2xl font-bold text-emerald-700">{regStats.active}</div>
              <div className="text-xs text-emerald-600">Active</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Clock className="h-5 w-5 text-amber-600" />
            <div>
              <div className="text-2xl font-bold text-amber-700">{regStats.pending}</div>
              <div className="text-xs text-amber-600">Pending</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-700">{regStats.expired}</div>
              <div className="text-xs text-red-600">Expired</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats by role — compact clickable chips */}
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
          const c = colors[role];
          return (
            <button
              key={role}
              onClick={() => setFilterRole(isActive ? "" : role)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${isActive ? `${c.active} ring-2 ring-offset-1 ring-current/20 shadow-sm` : c.inactive}`}
            >
              {iconMap[role]}
              {roleLabels[role]}
              <span className={`ml-0.5 text-xs font-bold ${isActive ? "" : "opacity-60"}`}>{count}</span>
            </button>
          );
        })}
        {filterRole && (
          <button onClick={() => setFilterRole("")} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-ink-muted hover:bg-gray-100 transition-colors">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or affiliation..."
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-8 py-2.5 text-sm text-ink placeholder:text-gray-400 transition-all duration-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {message && <Alert tone={messageType}>{message}</Alert>}

      {/* Create user (invite) */}
      {showCreate && (
        <Card accent="brand">
          <CardHeader><h3 className="text-sm font-semibold text-ink">{t("users.inviteNewUser")}</h3></CardHeader>
          <CardBody className="space-y-4">
            {/* Thai name fields */}
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.thaiInfo")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={t("users.prefixTh")}>
                <Input value={newUser.prefixTh} onChange={(e) => {
                  const updated = { ...newUser, prefixTh: e.target.value };
                  updated.name = `${updated.prefixTh}${updated.firstNameTh} ${updated.lastNameTh}`.trim();
                  setNewUser(updated);
                }} placeholder={t("users.prefixThPlaceholder")} />
              </Field>
              <Field label={t("users.firstNameTh")} required>
                <Input value={newUser.firstNameTh} onChange={(e) => {
                  const updated = { ...newUser, firstNameTh: e.target.value };
                  updated.name = `${updated.prefixTh}${updated.firstNameTh} ${updated.lastNameTh}`.trim();
                  setNewUser(updated);
                }} placeholder="ชื่อ" />
              </Field>
              <Field label={t("users.lastNameTh")} required>
                <Input value={newUser.lastNameTh} onChange={(e) => {
                  const updated = { ...newUser, lastNameTh: e.target.value };
                  updated.name = `${updated.prefixTh}${updated.firstNameTh} ${updated.lastNameTh}`.trim();
                  setNewUser(updated);
                }} placeholder="นามสกุล" />
              </Field>
            </div>
            {/* English name fields */}
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.englishInfo")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={t("users.prefixEn")}>
                <Input value={newUser.prefixEn} onChange={(e) => setNewUser({ ...newUser, prefixEn: e.target.value })} placeholder={t("users.prefixEnPlaceholder")} />
              </Field>
              <Field label={t("users.firstNameEn")}>
                <Input value={newUser.firstNameEn} onChange={(e) => setNewUser({ ...newUser, firstNameEn: e.target.value })} placeholder="First Name" />
              </Field>
              <Field label={t("users.lastNameEn")}>
                <Input value={newUser.lastNameEn} onChange={(e) => setNewUser({ ...newUser, lastNameEn: e.target.value })} placeholder="Last Name" />
              </Field>
            </div>
            {/* Email & Affiliation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("users.email")} required>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@dpstcon.org" />
              </Field>
              <Field label={t("users.affiliation")}>
                <Input value={newUser.affiliation} onChange={(e) => setNewUser({ ...newUser, affiliation: e.target.value })} placeholder={t("users.affiliationPlaceholder")} />
              </Field>
            </div>
            <Field label={t("users.roles")}>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r, newUser.roles, (roles) => setNewUser({ ...newUser, roles }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      newUser.roles.includes(r)
                        ? "bg-brand-50 border-brand-300 text-brand-700"
                        : "bg-white border-border text-ink-muted hover:border-brand-200"
                    }`}
                  >
                    {roleLabels[r]}
                  </button>
                ))}
              </div>
            </Field>
            <p className="text-xs text-ink-muted">{t("users.inviteEmailNote")}</p>
          </CardBody>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={createUser} loading={creating} disabled={(!newUser.firstNameTh && !newUser.name) || !newUser.email}>
              <Send className="h-4 w-4" />{t("users.sendInvitation")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Bulk import */}
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
                {bulkResults.map((r, i) => (
                  <p key={i} className={r.status === "invited" ? "text-green-700" : r.status === "updated_roles" ? "text-blue-600" : "text-red-600"}>
                    {r.email}: {r.status === "invited" ? t("users.invited") : r.status === "updated_roles" ? t("users.rolesUpdated") : t("users.failed")}
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

      {/* User table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-surface-alt/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-ink transition-colors">
                      {t("users.name")} <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <button onClick={() => toggleSort("email")} className="flex items-center gap-1 hover:text-ink transition-colors">
                      {t("users.email")} <SortIcon col="email" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                    <button onClick={() => toggleSort("affiliation")} className="flex items-center gap-1 hover:text-ink transition-colors">
                      {t("users.affiliation")} <SortIcon col="affiliation" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.roles")}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider w-32">{t("users.actionsCol")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const userRoles = u.roles || [u.role];
                  return (
                    <tr key={u.id} className="border-b border-border/40 hover:bg-surface-hover/50 transition-colors group">
                      <td className="px-4 py-3">
                        <button onClick={() => setExpandedId(expandedId === u.id ? null : u.id)} className="text-left w-full group/name">
                          <div className="font-medium text-ink group-hover/name:text-brand-600 transition-colors">{displayNameTh(u)}</div>
                          {(u.firstNameEn || u.lastNameEn) && <div className="text-xs text-ink-muted">{displayNameEn(u)}</div>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-ink-light">{u.email}</td>
                      <td className="px-4 py-3 text-ink-light">{u.affiliation || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.map((r) => (
                            <Badge key={r} tone={ROLE_COLORS[r] || "neutral"} className="text-xs">
                              {roleLabels[r] || r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => openModal("edit", u)} className="p-1.5 rounded-lg text-ink-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => openModal("password", u)} className="p-1.5 rounded-lg text-ink-muted hover:text-yellow-600 hover:bg-yellow-50 transition-colors" title="Reset Password">
                            <KeyRound className="h-4 w-4" />
                          </button>
                          {!u.isActive && (
                            <button onClick={() => resendInvite(u.id)} className="p-1.5 rounded-lg text-ink-muted hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Resend Invitation">
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => openModal("delete", u)} className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
        {filtered.length > 0 && (
          <CardFooter className="text-xs text-ink-muted">
            {t("users.showingUsers", { n: filtered.length, total: users.length })}
          </CardFooter>
        )}
      </Card>

      {filtered.length === 0 && (
        <EmptyState
          icon={<Search className="h-14 w-14" />}
          title={t("users.noUsersFound")}
          body={t("users.adjustSearch")}
        />
      )}

      {/* ─── Modal Overlay ─── */}
      {modalMode && selectedUser && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
          onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="bg-surface rounded-xl border border-border shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Edit modal */}
            {modalMode === "edit" && (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <div>
                    <h3 id="modal-title" className="text-base font-semibold text-ink flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-brand-500" />{t("users.editUser")}
                    </h3>
                    <p className="text-sm text-ink-muted mt-0.5">{selectedUser.email}</p>
                  </div>
                  <button onClick={closeModal} className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Thai name fields */}
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.thaiInfo")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label={t("users.prefixTh")}>
                      <Input value={editForm.prefixTh} onChange={(e) => {
                        const updated = { ...editForm, prefixTh: e.target.value };
                        updated.name = `${updated.prefixTh}${updated.firstNameTh} ${updated.lastNameTh}`.trim();
                        setEditForm(updated);
                      }} placeholder={t("users.prefixThPlaceholder")} />
                    </Field>
                    <Field label={t("users.firstNameTh")}>
                      <Input value={editForm.firstNameTh} onChange={(e) => {
                        const updated = { ...editForm, firstNameTh: e.target.value };
                        updated.name = `${updated.prefixTh}${updated.firstNameTh} ${updated.lastNameTh}`.trim();
                        setEditForm(updated);
                      }} placeholder="ชื่อ" />
                    </Field>
                    <Field label={t("users.lastNameTh")}>
                      <Input value={editForm.lastNameTh} onChange={(e) => {
                        const updated = { ...editForm, lastNameTh: e.target.value };
                        updated.name = `${updated.prefixTh}${updated.firstNameTh} ${updated.lastNameTh}`.trim();
                        setEditForm(updated);
                      }} placeholder="นามสกุล" />
                    </Field>
                  </div>
                  {/* English name fields */}
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t("users.englishInfo")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label={t("users.prefixEn")}>
                      <Input value={editForm.prefixEn} onChange={(e) => setEditForm({ ...editForm, prefixEn: e.target.value })} placeholder={t("users.prefixEnPlaceholder")} />
                    </Field>
                    <Field label={t("users.firstNameEn")}>
                      <Input value={editForm.firstNameEn} onChange={(e) => setEditForm({ ...editForm, firstNameEn: e.target.value })} placeholder="First Name" />
                    </Field>
                    <Field label={t("users.lastNameEn")}>
                      <Input value={editForm.lastNameEn} onChange={(e) => setEditForm({ ...editForm, lastNameEn: e.target.value })} placeholder="Last Name" />
                    </Field>
                  </div>
                  {/* Full name (auto-generated, hidden input) */}
                  <input type="hidden" value={editForm.name} />
                  <Field label={t("users.affiliation")}>
                    <Input value={editForm.affiliation} onChange={(e) => setEditForm({ ...editForm, affiliation: e.target.value })} placeholder={t("users.affiliationPlaceholder")} />
                  </Field>
                  <Field label={t("users.roles")}>
                    <div className="flex flex-wrap gap-2">
                      {ALL_ROLES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleRole(r, editForm.roles, (roles) => setEditForm({ ...editForm, roles }))}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            editForm.roles.includes(r)
                              ? "bg-brand-50 border-brand-300 text-brand-700"
                              : "bg-white border-border text-ink-muted hover:border-brand-200"
                          }`}
                        >
                          {roleLabels[r]}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Bio / Notes">
                    <Textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} placeholder="Academic position, expertise, etc." />
                  </Field>
                </div>
                <div className="flex justify-end gap-2 px-6 py-3 border-t border-border bg-surface-alt rounded-b-xl">
                  <Button variant="secondary" size="sm" onClick={closeModal}>{t("common.cancel")}</Button>
                  <Button size="sm" onClick={saveEdit} loading={saving}>Save Changes</Button>
                </div>
              </>
            )}

            {/* Password modal */}
            {modalMode === "password" && (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <div>
                    <h3 id="modal-title" className="text-base font-semibold text-ink flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-yellow-500" />Reset Password
                    </h3>
                    <p className="text-sm text-ink-muted mt-0.5">{displayNameTh(selectedUser)} — {selectedUser.email}</p>
                  </div>
                  <button onClick={closeModal} className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <Field label="New Password" hint="Minimum 8 characters" required>
                    <div className="relative">
                      <Input type={showPw ? "text" : "password"} value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Enter new password" autoFocus className="pr-10" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-ink-muted hover:text-ink">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                  {resetPw && resetPw.length < 8 && (
                    <p className="text-xs text-danger">Password must be at least 8 characters ({8 - resetPw.length} more needed)</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 px-6 py-3 border-t border-border bg-surface-alt rounded-b-xl">
                  <Button variant="secondary" size="sm" onClick={closeModal}>{t("common.cancel")}</Button>
                  <Button size="sm" onClick={resetPassword} loading={saving} disabled={!resetPw || resetPw.length < 8}>Reset Password</Button>
                </div>
              </>
            )}

            {/* Delete modal */}
            {modalMode === "delete" && (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 id="modal-title" className="text-base font-semibold text-ink flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-danger" />Delete User
                  </h3>
                  <button onClick={closeModal} className="text-ink-muted hover:text-ink p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-6 py-5">
                  <div className="flex items-center gap-4 rounded-xl bg-red-50 border border-red-200 p-5">
                    <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <Trash2 className="h-6 w-6 text-danger" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-ink">{displayNameTh(selectedUser)}</p>
                      <p className="text-sm text-ink-muted">{selectedUser.email}{selectedUser.affiliation ? ` · ${selectedUser.affiliation}` : ""}</p>
                      <p className="text-sm text-danger mt-2 font-medium">This action cannot be undone.</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-6 py-3 border-t border-border bg-surface-alt rounded-b-xl">
                  <Button variant="secondary" size="sm" onClick={closeModal}>{t("common.cancel")}</Button>
                  <Button variant="danger" size="sm" onClick={deleteUser} loading={saving}>Confirm Delete</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
