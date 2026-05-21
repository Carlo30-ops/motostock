import { Delete } from "lucide-react";
import { cn } from "../../lib/utils";

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

export function NumericKeypad({ value, onChange, className }: NumericKeypadProps) {
  const press = (key: string) => {
    if (key === "C") {
      onChange("");
      return;
    }
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    onChange(`${value}${key}`);
  };

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className={cn(
            "h-12 rounded-lg border border-border font-semibold text-lg",
            "bg-card hover:bg-muted active:scale-[0.98] transition-transform",
            key === "C" && "text-destructive",
            key === "⌫" && "flex items-center justify-center"
          )}
        >
          {key === "⌫" ? <Delete className="w-5 h-5" /> : key}
        </button>
      ))}
    </div>
  );
}
