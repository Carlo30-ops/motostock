import { Search, X, Wallet, AlertCircle } from "lucide-react";
import { Client } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/Card";
import { Input } from "@shared/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { useMemo, useState } from "react";

interface ClientSelectorProps {
  clients: Client[];
  selectedClient: Client | null;
  onSelect: (client: Client | null) => void;
}

export function ClientSelector({ clients, selectedClient, onSelect }: ClientSelectorProps) {
  const [clientSearch, setClientSearch] = useState("");

  const filteredClients = useMemo(() => {
    if (clientSearch.length < 2) return [];
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone.includes(clientSearch)
    );
  }, [clientSearch, clients]);

  const isOilChangePending = (client: Client) => {
    if (!client.lastServiceDate) return false;
    const diffTime = Math.abs(new Date().getTime() - new Date(client.lastServiceDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 90;
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="py-3 bg-muted/20 border-b border-border">
        <CardTitle className="text-sm flex justify-between items-center">
          <span>Cliente (Opcional)</span>
          {selectedClient && (
            <button 
              onClick={() => onSelect(null)} 
              className="text-xs font-normal text-muted-foreground hover:text-foreground flex items-center"
            >
              <X className="w-3 h-3 mr-1"/> Limpiar
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {!selectedClient ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o teléfono..." 
              className="pl-9"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            {clientSearch.length >= 2 && (
              <div className="absolute top-full mt-1 w-full bg-card border border-border rounded shadow-lg z-10 max-h-[200px] overflow-auto">
                {filteredClients.map(c => (
                  <div 
                    key={c.id} 
                    className="p-2 border-b border-border hover:bg-muted cursor-pointer" 
                    onClick={() => { onSelect(c); setClientSearch(""); }}
                  >
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone} | {c.motorcycleModel}</div>
                  </div>
                ))}
                {filteredClients.length === 0 && <div className="p-3 text-sm text-muted-foreground">No hay resultados.</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="font-bold flex items-center gap-2">
              {selectedClient.name}
            </div>
            <div className="text-sm text-muted-foreground">{selectedClient.motorcycleModel} | {selectedClient.phone}</div>
            
            {selectedClient.creditBalance > 0 && (
              <div className="text-sm font-bold text-success flex items-center gap-1 mt-1">
                <Wallet className="w-4 h-4"/> Cupo disponible: {formatCurrency(selectedClient.creditBalance)}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Cupo máximo: {formatCurrency(selectedClient.creditLimit)}
            </div>
            
            {isOilChangePending(selectedClient) && (
              <div className="mt-2 bg-warning/10 border border-warning/30 p-2 rounded flex items-start gap-2 text-warning-foreground text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Este cliente tiene cambio de aceite pendiente.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
