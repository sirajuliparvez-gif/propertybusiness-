"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, CalendarDays, Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importDataAction } from "@/lib/actions/import-export";
import type { ImportResult } from "@/lib/import-export/types";
import { cn } from "@/lib/utils";

export function ImportExportPanel({ properties }: { properties: { id: string; name: string }[] }) {
  const t = useTranslations("Properties");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [monthlyPropertyId, setMonthlyPropertyId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null);
    setResult(null);
    setErrorMsg(null);
  }

  function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      try {
        const r = await importDataAction(formData);
        setResult(r);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : t("importExportGenericError"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" />
            {t("monthlyEntryTitle")}
          </CardTitle>
          <CardDescription>{t("monthlyEntryDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:max-w-sm">
          <Select
            value={monthlyPropertyId}
            onValueChange={(v) => setMonthlyPropertyId(v ?? "")}
            items={properties.map((p) => ({ value: p.id, label: p.name }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectPropertyPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {monthlyPropertyId ? (
            <Button
              nativeButton={false}
              render={<a href={`/api/import-export/monthly?propertyId=${monthlyPropertyId}`} />}
            >
              <Download className="size-3.5" />
              {t("monthlyEntryButton")}
            </Button>
          ) : (
            <Button disabled>
              <Download className="size-3.5" />
              {t("monthlyEntryButton")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4" />
            {t("importDataTitle")}
          </CardTitle>
          <CardDescription>{t("importDataDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="block text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
            />
            <Button type="button" onClick={handleImport} disabled={!fileName || isPending}>
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t("importDataButton")}
            </Button>
          </div>

          {errorMsg ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="size-3.5" />
              {errorMsg}
            </p>
          ) : null}

          {result ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-success" />
                {t("importResultSummary", { created: result.totalCreated, errors: result.totalErrors })}
              </div>
              <div className="flex flex-col gap-2">
                {result.results.map((r) => (
                  <div key={r.sheet} className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{r.sheet}</span>
                      <Badge className="border-transparent bg-success/15 text-success">
                        {t("importRowsCreated", { count: r.created })}
                      </Badge>
                      {r.errors.length > 0 ? (
                        <Badge className={cn("border-transparent bg-destructive/15 text-destructive")}>
                          {t("importRowsFailed", { count: r.errors.length })}
                        </Badge>
                      ) : null}
                    </div>
                    {r.errors.length > 0 ? (
                      <ul className="ml-4 list-disc text-xs text-muted-foreground">
                        {r.errors.map((err, i) => (
                          <li key={i}>
                            {t("importRowLabel", { row: err.row })}: {err.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
