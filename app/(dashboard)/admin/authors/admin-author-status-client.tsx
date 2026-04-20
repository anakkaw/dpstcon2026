"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionTitle } from "@/components/ui/section-title";
import { SummaryStatCard } from "@/components/ui/summary-stat-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardBody } from "@/components/ui/card";
import { getSubmissionStatusLabels, SUBMISSION_STATUS_COLORS } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { displayNameTh } from "@/lib/display-name";
import type { AuthorStatusRow } from "@/server/admin-author-status-data";
import {
  Users, Search, X, FileText, CheckCircle2, Clock,
  AlertTriangle, UserX, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

// Each filter group defines which submission statuses it covers.
// null statuses = match all; empty array = match authors with no submissions.
type FilterGroupKey = "ALL" | "NO_SUBMISSION" | "DRAFT" | "ADVISOR_PENDING" | "IN_REVIEW" | "ACCEPTED" | "REJECTED";

interface FilterGroup {
  key: FilterGroupKey;
  label: string;
  statuses: string[] | null;
}

const FILTER_GROUPS: FilterGroup[] = [
  { key: "ALL",             label: "ทั้งหมด",                   statuses: null },
  { key: "NO_SUBMISSION",   label: "ยังไม่ส่งบทความ",            statuses: [] },
  { key: "DRAFT",           label: "อยู่ในร่าง",                 statuses: ["DRAFT"] },
  { key: "ADVISOR_PENDING", label: "รออาจารย์ที่ปรึกษา",          statuses: ["ADVISOR_APPROVAL_PENDING"] },
  { key: "IN_REVIEW",       label: "ส่งแล้ว / กำลังพิจารณา",     statuses: ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED", "REBUTTAL"] },
  { key: "ACCEPTED",        label: "ตอบรับแล้ว",                 statuses: ["ACCEPTED", "CAMERA_READY_PENDING", "CAMERA_READY_SUBMITTED"] },
  { key: "REJECTED",        label: "ปฏิเสธ",                    statuses: ["REJECTED", "DESK_REJECTED"] },
];

function matchesGroup(author: AuthorStatusRow, group: FilterGroup): boolean {
  if (group.statuses === null) return true;
  if (group.statuses.length === 0) return author.submissions.length === 0;
  return author.submissions.some((s) => group.statuses!.includes(s.status));
}

function getAuthorHighestStatus(subs: AuthorStatusRow["submissions"]): string {
  if (subs.length === 0) return "NO_SUBMISSION";

  const PRIORITY: Record<string, number> = {
    ACCEPTED: 0, CAMERA_READY_SUBMITTED: 1, CAMERA_READY_PENDING: 2,
    REJECTED: 3, DESK_REJECTED: 4,
    UNDER_REVIEW: 5, REBUTTAL: 6, REVISION_REQUIRED: 7,
    SUBMITTED: 8, ADVISOR_APPROVAL_PENDING: 9,
    DRAFT: 10, WITHDRAWN: 11,
  };

  return subs.reduce((best, s) => {
    return (PRIORITY[s.status] ?? 99) < (PRIORITY[best] ?? 99) ? s.status : best;
  }, subs[0].status);
}

export function AdminAuthorStatusClient({ authors }: { authors: AuthorStatusRow[] }) {
  const { t } = useI18n();
  const statusLabels = getSubmissionStatusLabels(t);

  const [search, setSearch] = useState("");
  const [activeKey, setActiveKey] = useState<FilterGroupKey>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Counts computed directly from authors — always matches what the filter shows
  const counts = useMemo(() => {
    const result = {} as Record<FilterGroupKey, number>;
    for (const group of FILTER_GROUPS) {
      result[group.key] = authors.filter((a) => matchesGroup(a, group)).length;
    }
    return result;
  }, [authors]);

  const activeGroup = FILTER_GROUPS.find((g) => g.key === activeKey)!;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return authors.filter((a) => {
      if (q) {
        const name = displayNameTh(a).toLowerCase();
        const email = a.email.toLowerCase();
        const affil = (a.affiliation ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !affil.includes(q)) return false;
      }
      return matchesGroup(a, activeGroup);
    });
  }, [authors, search, activeGroup]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Breadcrumb
        items={[
          { label: "หน้าหลัก", href: "/dashboard" },
          { label: "ติดตามสถานะผู้เขียน" },
        ]}
      />

      <SectionTitle
        title="ติดตามสถานะผู้เขียน"
        subtitle="ภาพรวมสถานะการส่งบทความของผู้เขียนทั้งหมดในระบบ"
      />

      {/* Summary cards — same source of truth as filter counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryStatCard label="ผู้เขียนทั้งหมด"           value={counts.ALL}             icon={<Users className="h-5 w-5" />}       color="blue"    />
        <SummaryStatCard label="ยังไม่ส่งบทความ"           value={counts.NO_SUBMISSION}   icon={<UserX className="h-5 w-5" />}        color="gray"    />
        <SummaryStatCard label="อยู่ในร่าง"                value={counts.DRAFT}           icon={<FileText className="h-5 w-5" />}     color="indigo"  />
        <SummaryStatCard label="รออาจารย์ที่ปรึกษา"        value={counts.ADVISOR_PENDING} icon={<Clock className="h-5 w-5" />}        color="amber"   />
        <SummaryStatCard label="ส่งแล้ว / กำลังพิจารณา"   value={counts.IN_REVIEW}       icon={<AlertTriangle className="h-5 w-5" />} color="violet"  />
        <SummaryStatCard label="ตอบรับแล้ว"               value={counts.ACCEPTED}        icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" />
      </div>

      {/* Filter chips + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTER_GROUPS.map((group) => (
            <button
              key={group.key}
              onClick={() => setActiveKey(group.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeKey === group.key
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {group.label} ({counts[group.key]})
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, อีเมล, สังกัด..."
            className="pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="ไม่พบผู้เขียน"
          body="ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3">ผู้เขียน</th>
                    <th className="px-4 py-3">สังกัด</th>
                    <th className="px-4 py-3 text-center">จำนวนบทความ</th>
                    <th className="px-4 py-3">สถานะสูงสุด</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((author) => {
                    const expanded = expandedIds.has(author.id);
                    const highestStatus = getAuthorHighestStatus(author.submissions);
                    const noSub = author.submissions.length === 0;

                    return (
                      <>
                        <tr
                          key={author.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => !noSub && toggleExpand(author.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{displayNameTh(author)}</div>
                            <div className="text-xs text-slate-500">{author.email}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {author.affiliation ?? <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {author.submissions.length}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {noSub ? (
                              <Badge tone="neutral">ยังไม่ส่งบทความ</Badge>
                            ) : (
                              <Badge tone={SUBMISSION_STATUS_COLORS[highestStatus] ?? "neutral"}>
                                {statusLabels[highestStatus] ?? highestStatus}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!noSub && (
                              <span className="text-slate-400">
                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </span>
                            )}
                          </td>
                        </tr>

                        {expanded && author.submissions.map((sub) => (
                          <tr key={sub.id} className="bg-slate-50/60">
                            <td colSpan={5} className="px-6 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    {sub.paperCode && (
                                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                                        {sub.paperCode}
                                      </span>
                                    )}
                                    <span className="truncate text-sm font-medium text-slate-700">{sub.title}</span>
                                  </div>
                                  {sub.trackName && (
                                    <div className="mt-0.5 text-xs text-slate-500">สาขา: {sub.trackName}</div>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <Badge tone={SUBMISSION_STATUS_COLORS[sub.status] ?? "neutral"}>
                                    {statusLabels[sub.status] ?? sub.status}
                                  </Badge>
                                  <Link
                                    href={`/submissions/${sub.id}`}
                                    className="text-blue-500 hover:text-blue-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              แสดง {filtered.length} จาก {authors.length} ผู้เขียน
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
