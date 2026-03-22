"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface FileUploadProps {
  submissionId: string;
  kind: "MANUSCRIPT" | "SUPPLEMENTARY" | "CAMERA_READY";
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  hint?: string;
  onUploadComplete?: (file: { id: string; originalName: string; storedKey: string }) => void;
  disabled?: boolean;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function FileUpload({
  submissionId,
  kind,
  accept = ".pdf,.doc,.docx",
  maxSizeMB = 50,
  label,
  hint,
  onUploadComplete,
  disabled = false,
}: FileUploadProps) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("fileUpload.attachFile");
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setFileName(file.name);

      // Validate size
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(t("fileUpload.fileTooLarge", { n: maxSizeMB }));
        setState("error");
        return;
      }

      // Validate file type client-side
      const allowedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
      const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (allowedTypes.length > 0 && !allowedTypes.includes(fileExt)) {
        setError(t("fileUpload.unsupportedType", { types: accept }));
        setState("error");
        return;
      }

      setState("uploading");
      setProgress(10);

      try {
        // Step 1: Get presigned upload URL
        const urlRes = await fetch(`/api/submissions/${submissionId}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size,
            kind,
          }),
        });

        if (!urlRes.ok) {
          const data = await urlRes.json();
          throw new Error(data.error || t("fileUpload.uploadUrlError"));
        }

        const { uploadUrl, fileKey } = await urlRes.json();
        setProgress(30);

        // Step 2: Upload file to R2 via presigned URL
        // Use XMLHttpRequest for real progress tracking (important on mobile)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              // Map upload progress to 30-90% range
              const pct = 30 + Math.round((e.loaded / e.total) * 60);
              setProgress(pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(t("fileUpload.uploadFailed")));
            }
          };

          xhr.onerror = () => reject(new Error(t("fileUpload.networkError")));
          xhr.ontimeout = () => reject(new Error(t("fileUpload.timeout")));
          xhr.timeout = 5 * 60 * 1000; // 5 minutes timeout

          xhr.send(file);
        });

        setProgress(95);

        // Step 3: Confirm upload
        const confirmRes = await fetch(`/api/submissions/${submissionId}/confirm-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileKey,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size,
            kind,
          }),
        });

        if (!confirmRes.ok) {
          throw new Error(t("fileUpload.confirmFailed"));
        }

        const { file: savedFile } = await confirmRes.json();
        setProgress(100);
        setState("success");
        onUploadComplete?.(savedFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("fileUpload.genericError"));
        setState("error");
      }
    },
    [submissionId, kind, accept, maxSizeMB, onUploadComplete, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so same file can be re-uploaded
      e.target.value = "";
    },
    [handleFile]
  );

  const reset = () => {
    setState("idle");
    setFileName("");
    setError("");
    setProgress(0);
  };

  // Build accept string with MIME types for better mobile compatibility
  const fullAccept = buildMobileAccept(accept);

  return (
    <div>
      {resolvedLabel && (
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
          {resolvedLabel}
        </p>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !disabled && state !== "uploading" && inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200",
          disabled
            ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
            : state === "uploading"
              ? "border-brand-300 bg-brand-50/30 cursor-wait"
              : state === "success"
                ? "border-emerald-300 bg-emerald-50/30 cursor-pointer"
                : state === "error"
                  ? "border-red-300 bg-red-50/30 cursor-pointer"
                  : "border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/20 cursor-pointer"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={fullAccept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled || state === "uploading"}
        />

        {state === "idle" && (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-ink-muted" />
            <p className="text-sm text-ink">
              {t("fileUpload.clickToSelect")}
            </p>
            {hint && <p className="text-xs text-ink-muted">{hint}</p>}
            <p className="text-xs text-ink-muted">
              {t("fileUpload.supported", { types: accept.replace(/\./g, "").toUpperCase(), n: maxSizeMB })}
            </p>
          </div>
        )}

        {state === "uploading" && (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 mx-auto text-brand-500 animate-spin" />
            <p className="text-sm text-ink">{t("fileUpload.uploading", { name: fileName })}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-ink-muted">{progress}%</p>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-2">
            <CheckCircle className="h-8 w-8 mx-auto text-emerald-500" />
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <p className="text-sm text-emerald-700 font-medium">{fileName}</p>
            </div>
            <p className="text-xs text-emerald-600">{t("fileUpload.success")}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="text-xs text-ink-muted hover:text-ink underline"
            >
              {t("fileUpload.uploadNew")}
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="text-xs text-ink-muted hover:text-ink underline"
            >
              {t("common.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Map file extensions to MIME types for mobile browser compatibility */
function buildMobileAccept(accept: string): string {
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".zip": "application/zip",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };

  const extensions = accept.split(",").map((t) => t.trim().toLowerCase());
  const mimeTypes = extensions
    .map((ext) => mimeMap[ext])
    .filter(Boolean);

  // Return both extensions AND MIME types for maximum compatibility
  return [...extensions, ...mimeTypes].join(",");
}
