"use client";

import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { useId, useRef, useState, useEffect } from "react";
import { DEBOUNCE_MS, MAX_TAG_PARAMS } from "./constants";
import type { SuggestionItem, TagChip } from "./types";
import { tryAddChipToList } from "./tag-utils";
import { useCatalogSuggestions } from "./use-catalog-suggestions";
import { useDebouncedValue } from "./use-debounced-value";

export type CatalogTagFilterProps = {
  tagChips: TagChip[];
  setTagChips: Dispatch<SetStateAction<TagChip[]>>;
  tagDraft: string;
  setTagDraft: (v: string) => void;
  onFilterChange: () => void;
};

export function CatalogTagFilter({
  tagChips,
  setTagChips,
  tagDraft,
  setTagDraft,
  onFilterChange,
}: CatalogTagFilterProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const apiNeedle = tagDraft.trim();
  const debouncedQ = useDebouncedValue(apiNeedle, DEBOUNCE_MS);
  const { items, sLoading, highlight, setHighlight } = useCatalogSuggestions(
    debouncedQ,
    "tag"
  );

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const showList =
    open && debouncedQ.length > 0 && (sLoading || items.length > 0);

  function commitDraft() {
    const next = tryAddChipToList(tagChips, tagDraft);
    if (!next) return;
    setTagChips(next);
    setTagDraft("");
    setOpen(false);
    setHighlight(-1);
    onFilterChange();
  }

  function pickSuggestion(item: SuggestionItem) {
    const next = tryAddChipToList(tagChips, item.value, item.label);
    if (!next) return;
    setTagChips(next);
    setTagDraft("");
    setOpen(false);
    setHighlight(-1);
    onFilterChange();
  }

  function removeChip(index: number) {
    setTagChips((prev) => prev.filter((_, i) => i !== index));
    onFilterChange();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (e.key === ",") {
      e.preventDefault();
      if (tagDraft.trim().length > 0) {
        commitDraft();
      }
      return;
    }
    if (e.key === "Enter") {
      if (showList && highlight >= 0 && items[highlight]) {
        e.preventDefault();
        pickSuggestion(items[highlight]!);
        return;
      }
      if (tagDraft.trim().length > 0) {
        e.preventDefault();
        commitDraft();
      }
      return;
    }
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h <= 0 ? items.length - 1 : h - 1));
    }
  }

  const chipDisplay = (c: TagChip) =>
    c.label && c.label !== c.needle ? c.label : c.needle;

  return (
    <div className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
        Tags
      </span>
      <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
        Add from suggestions or type a substring and press Enter or comma. Remove
        with ×. Up to {MAX_TAG_PARAMS} tags.
      </p>
      <div ref={containerRef} className="relative">
        <div className="flex min-h-[2.5rem] flex-wrap items-center gap-2 rounded-md border border-neutral-300 bg-white px-2 py-1.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          {tagChips.map((c, i) => (
            <span
              key={`${c.needle}-${i}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <span className="truncate" title={c.needle}>
                {chipDisplay(c)}
              </span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                aria-label={`Remove tag ${c.needle}`}
                onClick={() => removeChip(i)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={showList}
            aria-autocomplete="list"
            value={tagDraft}
            onChange={(e) => {
              setTagDraft(e.target.value);
              setOpen(true);
              onFilterChange();
            }}
            onFocus={() => {
              if (apiNeedle.length > 0) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder={
              tagChips.length >= MAX_TAG_PARAMS
                ? "Tag limit reached"
                : "Type to search tags…"
            }
            disabled={
              tagChips.length >= MAX_TAG_PARAMS && tagDraft.length === 0
            }
            className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-neutral-900 outline-none focus:ring-0 dark:text-neutral-100 disabled:opacity-50"
          />
        </div>
        {showList ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
          >
            {sLoading ? (
              <li className="px-3 py-2 text-neutral-500">Loading…</li>
            ) : (
              items.map((item, i) => (
                <li key={`${item.value}-${i}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={`flex w-full flex-col px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                      i === highlight ? "bg-neutral-100 dark:bg-neutral-800" : ""
                    }`}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => pickSuggestion(item)}
                  >
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {item.value}
                    </span>
                    {item.label && item.label !== item.value ? (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {item.label}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
