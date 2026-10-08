"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { useDebouncedValue } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";

/** Campo de búsqueda con debounce (no consulta en cada tecla). */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
  delay = 300,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedValue(text, delay);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Si el valor cambia desde fuera (p. ej. "Limpiar filtros"), se sincroniza.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== debounced) setText(value);
  }

  return (
    <InputGroup className={cn("h-10 bg-card sm:h-9", className)}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        inputMode="search"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Limpiar búsqueda" onClick={() => setText("")}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
