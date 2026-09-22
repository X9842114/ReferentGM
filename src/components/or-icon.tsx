import { orColorIcon, type OrColor } from "@/lib/or-rewards";
import { cn } from "@/lib/utils";

type OrIconProps = {
  color: OrColor;
  className?: string;
  size?: number;
};

export function OrIcon({ color, className, size = 16 }: OrIconProps) {
  return (
    <img
      src={orColorIcon(color)}
      alt={color === "bleu" ? "Or Bleu" : "Or Rouge"}
      width={size}
      height={size}
      className={cn("inline-block shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}
