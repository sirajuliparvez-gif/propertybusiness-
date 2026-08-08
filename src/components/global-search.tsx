"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Building2, Users } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchAction } from "@/lib/actions";

type Results = Awaited<ReturnType<typeof searchAction>>;

export function GlobalSearch() {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ properties: [], tenants: [] });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchAction(query));
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const hasResults = results.properties.length > 0 || results.tenants.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-72 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden truncate sm:inline">{t("searchPlaceholder")}</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:flex">
          ⌘K
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setQuery("");
        }}
        title={t("search")}
        description={t("searchPlaceholder")}
      >
        <CommandInput
          placeholder={t("searchPlaceholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {!isPending && query.length >= 2 && !hasResults ? (
            <CommandEmpty>{t("searchNoResults")}</CommandEmpty>
          ) : null}
          {results.properties.length > 0 ? (
            <CommandGroup heading={t("properties")}>
              {results.properties.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`property-${p.id}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push("/properties");
                  }}
                >
                  <Building2 className="size-4" />
                  <div className="min-w-0">
                    <p className="truncate">{p.name}</p>
                    {p.address ? (
                      <p className="truncate text-xs text-muted-foreground">{p.address}</p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {results.tenants.length > 0 ? (
            <CommandGroup heading={t("tenants")}>
              {results.tenants.map((tn) => (
                <CommandItem
                  key={tn.id}
                  value={`tenant-${tn.id}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push("/tenants");
                  }}
                >
                  <Users className="size-4" />
                  <div className="min-w-0">
                    <p className="truncate">{tn.name}</p>
                    {tn.contactInfo ? (
                      <p className="truncate text-xs text-muted-foreground">{tn.contactInfo}</p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
