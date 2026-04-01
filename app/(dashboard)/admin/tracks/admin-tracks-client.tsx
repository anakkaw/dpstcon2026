"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SectionTitle } from "@/components/ui/section-title";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalShell } from "@/components/ui/modal-shell";
import { useI18n } from "@/lib/i18n";
import { displayNameTh, displayNameEn } from "@/lib/display-name";
import type { AdminTrackData, AdminTrackUser } from "@/server/admin-tracks-data";
import { Plus, Search, Pencil, Trash2, Layers } from "lucide-react";

type ModalMode = null | "create" | "edit" | "delete";

export function AdminTracksClient({
  initialTracks,
  initialUsers,
}: {
  initialTracks: AdminTrackData[];
  initialUsers: AdminTrackUser[];
}) {
  const { t, locale } = useI18n();
  const [tracks, setTracks] = useState<AdminTrackData[]>(initialTracks);
  const [users] = useState<AdminTrackUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "danger">("success");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedTrack, setSelectedTrack] = useState<AdminTrackData | null>(null);
  const [form, setForm] = useState({ name: "", description: "", headUserId: "" });
  const [saving, setSaving] = useState(false);

  function showMsg(text: string, type: "success" | "danger" = "success") {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  }

  async function refreshTracks() {
    try {
      const res = await fetch("/api/tracks");
      const data = await res.json();
      if (data.tracks) setTracks(data.tracks);
    } catch {
      // ignore
    }
  }

  function openCreate() {
    setForm({ name: "", description: "", headUserId: "" });
    setModalMode("create");
  }

  function openEdit(track: AdminTrackData) {
    setSelectedTrack(track);
    setForm({
      name: track.name,
      description: track.description || "",
      headUserId: track.headUserId || "",
    });
    setModalMode("edit");
  }

  function openDelete(track: AdminTrackData) {
    setSelectedTrack(track);
    setModalMode("delete");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedTrack(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const isCreate = modalMode === "create";
      const url = isCreate ? "/api/tracks" : `/api/tracks/${selectedTrack!.id}`;
      const method = isCreate ? "POST" : "PATCH";

      const payload: Record<string, unknown> = { name: form.name, description: form.description || null };
      if (isCreate) {
        payload.headUserId = form.headUserId || undefined;
      } else {
        payload.headUserId = form.headUserId || null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showMsg(t(isCreate ? "trackAdmin.createSuccess" : "trackAdmin.updateSuccess"));
        closeModal();
        void refreshTracks();
      } else {
        const data = await res.json();
        showMsg(data.error || "Error", "danger");
      }
    } catch {
      showMsg("Error", "danger");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!selectedTrack) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tracks/${selectedTrack.id}`, { method: "DELETE" });
      if (res.ok) {
        showMsg(t("trackAdmin.deleteSuccess"));
        closeModal();
        void refreshTracks();
      } else {
        const data = await res.json();
        const errMsg = data.error?.includes("submissions")
          ? t("trackAdmin.hasSubmissions")
          : data.error || "Error";
        showMsg(errMsg, "danger");
      }
    } catch {
      showMsg("Error", "danger");
    }
    setSaving(false);
  }

  function displayUser(u: AdminTrackUser | AdminTrackData["head"]) {
    if (!u) return "";
    if (locale === "th") return displayNameTh(u) || u.name || u.email;
    return displayNameEn(u) || u.name || u.email;
  }

  const filtered = useMemo(() => {
    if (!search) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (track) =>
        track.name.toLowerCase().includes(q) ||
        (track.description?.toLowerCase().includes(q)) ||
        (track.head && displayUser(track.head).toLowerCase().includes(q))
    );
  }, [tracks, search, locale]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle
          title={t("trackAdmin.title")}
          subtitle={t("trackAdmin.subtitle")}
        />
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("trackAdmin.createTrack")}
        </Button>
      </div>

      {message && (
        <Alert tone={messageType}>
          {message}
        </Alert>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("trackAdmin.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {/* Track count */}
      <p className="text-sm text-muted">
        {t("trackAdmin.trackCount", { count: String(filtered.length) })}
      </p>

      {/* Track list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-12 w-12" />}
          title={t("trackAdmin.noTracks")}
          body={t("trackAdmin.noTracksDesc")}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((track) => (
            <Card key={track.id}>
              <CardBody>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-ink">{track.name}</h3>
                    {track.description && (
                      <p className="mt-0.5 text-sm text-muted line-clamp-1">
                        {track.description}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted">
                      <span className="font-medium">{t("trackAdmin.programChair")}:</span>{" "}
                      {track.head ? (
                        <span className="text-ink">
                          {displayUser(track.head)}{" "}
                          <span className="text-muted">({track.head.email})</span>
                        </span>
                      ) : (
                        <span className="italic text-gray-400">{t("trackAdmin.noChair")}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(track)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openDelete(track)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(modalMode === "create" || modalMode === "edit") && (
        <ModalShell
          open
          title={t(modalMode === "create" ? "trackAdmin.createTrack" : "trackAdmin.editTrack")}
          onClose={closeModal}
        >
          <div className="space-y-4">
            <Field label={t("trackAdmin.trackName")}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("trackAdmin.trackName")}
              />
            </Field>

            <Field label={t("trackAdmin.description")}>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("trackAdmin.description")}
                rows={3}
              />
            </Field>

            <Field label={t("trackAdmin.programChair")}>
              <Select
                value={form.headUserId}
                onChange={(e) => setForm({ ...form, headUserId: e.target.value })}
              >
                <option value="">{t("trackAdmin.selectChair")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {displayUser(u)} ({u.email})
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeModal}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Delete Confirmation */}
      {modalMode === "delete" && selectedTrack && (
        <ConfirmDialog
          open
          title={t("trackAdmin.deleteTrack")}
          description={t("trackAdmin.deleteConfirm", { name: selectedTrack.name })}
          tone="danger"
          confirmLabel={t("trackAdmin.deleteTrack")}
          cancelLabel={t("common.cancel")}
          onConfirm={handleDelete}
          onCancel={closeModal}
          loading={saving}
        />
      )}
    </div>
  );
}
