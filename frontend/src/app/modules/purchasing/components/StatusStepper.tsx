import React from "react";
import { PurchaseOrder } from "../../../lib/store";
import { cn } from "../../../components/ui/utils";
import { 
  CheckCircle2, 
  Clock, 
  Package, 
  Send, 
  AlertCircle
} from "lucide-react";

interface StatusStepperProps {
  status: PurchaseOrder["status"];
  className?: string;
}

const STEPS = [
  { id: "draft", label: "Borrador", icon: Clock },
  { id: "pending_approval", label: "Aprobación", icon: AlertCircle },
  { id: "approved", label: "Aprobada", icon: CheckCircle2 },
  { id: "ordered", label: "Pedido", icon: Send },
  { id: "received", label: "Recibido", icon: Package },
];

export function StatusStepper({ status, className }: StatusStepperProps) {
  // Manejo de estados especiales (rejected, cancelled, partially_received)
  const isRejected = status === "rejected";
  const isCancelled = status === "cancelled";
  const isPartial = status === "partially_received";

  const getStepStatus = (stepId: string) => {
    const statusPriority: Record<string, number> = {
      draft: 0,
      pending_approval: 1,
      approved: 2,
      ordered: 3,
      partially_received: 4,
      received: 5,
    };

    const currentPriority = statusPriority[status] ?? 0;
    const stepPriority = statusPriority[stepId] ?? 0;

    if (isRejected && stepId === "pending_approval") return "rejected";
    if (isCancelled) return "cancelled";
    if (isPartial && stepId === "received") return "partial";

    if (currentPriority > stepPriority) return "completed";
    if (currentPriority === stepPriority) return "current";
    return "upcoming";
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const stepStatus = getStepStatus(step.id);
          const Icon = step.icon;
          const nextStep = STEPS[index + 1];

          return (
            <React.Fragment key={step.id}>
              {/* Step Icon and Label */}
              <div className="flex flex-col items-center relative z-10">
                <div 
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                    stepStatus === "completed" && "bg-green-100 border-green-500 text-green-600",
                    stepStatus === "current" && "bg-blue-100 border-blue-500 text-blue-600",
                    stepStatus === "rejected" && "bg-red-100 border-red-500 text-red-600",
                    stepStatus === "cancelled" && "bg-gray-100 border-gray-500 text-gray-600",
                    stepStatus === "upcoming" && "bg-white border-gray-300 text-gray-400",
                    stepStatus === "partial" && "bg-yellow-100 border-yellow-500 text-yellow-600"
                  )}
                >
                  {stepStatus === "completed" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>
                <span 
                  className={cn(
                    "text-xs mt-2 font-medium",
                    stepStatus === "current" ? "text-blue-600" : "text-gray-500"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector Line */}
              {nextStep && (
                <div 
                  className={cn(
                    "flex-1 h-0.5 mx-2 -mt-6",
                    getStepStatus(nextStep.id) === "upcoming" ? "bg-gray-200" : "bg-green-500"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
