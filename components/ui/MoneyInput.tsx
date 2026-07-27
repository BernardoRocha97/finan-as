"use client";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Props {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
}

export function MoneyInput({ value, onChange, placeholder = "0,00", className }: Props) {
  const num = Number(value ?? 0);
  const [display, setDisplay] = useState(num ? num.toFixed(2).replace(".", ",") : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9,.-]/g, "");
    setDisplay(raw);
    const num = parseFloat(raw.replace(",", "."));
    if (!isNaN(num)) onChange(num);
  };

  const handleBlur = () => {
    const num = parseFloat(display.replace(",", "."));
    if (!isNaN(num)) setDisplay(num.toFixed(2).replace(".", ","));
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
      <Input
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`pl-7 ${className ?? ""}`}
      />
    </div>
  );
}
