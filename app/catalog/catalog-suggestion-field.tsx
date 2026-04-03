"use client";

import type { KeyboardEvent } from "react";
import { useId, useMemo, useRef, useState, useEffect } from "react";
import { DEBOUNCE_MS, FILTER_INPUT_CLASS } from "./constants";
import type { SuggestionKind, SuggestionItem } from "./types";
import { useCatalogSuggestions } from "./use-catalog-suggestions";
import { useDebouncedValue } from "./use-debounced-value";

export type CatalogSuggestionFieldProps = {
  kind: SuggestionKind;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
};

export function CatalogSuggestionField({
  kind,
  label,
  placeholder,
  value,
  onChange,
}: CatalogSuggestionFieldProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const apiNeedle = useMemo(() => value.trim(), [value]);
  const debouncedQ = useDebouncedValue(apiNeedle, DEBOUNCE_MS);
  const { items, sLoading, highlight, setHighlight } = useCatalogSuggestions(
    debouncedQ,
    kind
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

  function applyPick(item: SuggestionItem) {
    onChange(item.value);
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
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
      return;
    }
    if (e.key === "Enter" && highlight >= 0 && items[highlight]) {
      e.preventDefault();
      applyPick(items[highlight]!);
    }
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
        {label}
      </span>
      <div ref={containerRef} className="relative">
        <input
          type="text"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={showList}
          aria-autocomplete="list"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (apiNeedle.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={FILTER_INPUT_CLASS}
        />
        {showList ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
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
                    onClick={() => applyPick(item)}
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
    </label>
  );
}
