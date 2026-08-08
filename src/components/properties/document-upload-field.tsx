"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadThing } from "@/lib/uploadthing";

export function DocumentUploadField({
  urlFieldName = "documentUrl",
  typeFieldName = "documentFileType",
  label,
}: {
  urlFieldName?: string;
  typeFieldName?: string;
  // Overrides the button's own text — the default ("Upload Agreement Copy")
  // was written when this component only ever uploaded a lease agreement
  // copy; any other use (NID card, tenant photo, ...) needs its own label so
  // multiple instances in the same form don't all read the same text.
  label?: string;
}) {
  const t = useTranslations("Properties");
  const buttonLabel = label ?? t("uploadDocument");
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ url: string; type: string } | null>(null);

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    onClientUploadComplete: (res) => {
      const file = res?.[0];
      if (file) setUploaded({ url: file.ufsUrl, type: file.type });
    },
    onUploadError: () => {
      setFileName(null);
    },
  });

  if (uploaded) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <a
          href={uploaded.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 truncate text-primary underline-offset-2 hover:underline"
        >
          {fileName ?? t("viewDocument")}
        </a>
        <input type="hidden" name={urlFieldName} value={uploaded.url} />
        <input type="hidden" name={typeFieldName} value={uploaded.type} />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setUploaded(null);
            setFileName(null);
          }}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setFileName(file.name);
          startUpload([file]);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Upload className="size-3.5" />
        )}
        {isUploading ? fileName : buttonLabel}
      </Button>
    </div>
  );
}
