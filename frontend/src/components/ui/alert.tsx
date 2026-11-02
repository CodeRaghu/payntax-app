import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const tones = {
  info: { className: "border-blue-200 bg-blue-50 text-blue-900", Icon: Info },
  success: { className: "border-green-200 bg-green-50 text-green-900", Icon: CheckCircle2 },
  warning: { className: "border-amber-200 bg-amber-50 text-amber-900", Icon: AlertTriangle },
  danger: { className: "border-red-200 bg-red-50 text-red-900", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border p-3 text-sm", toneClass, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
