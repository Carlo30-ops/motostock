import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useCompanyConfig, useUpsertCompanyConfig } from "../api/hooks";

type FormState = {
  nit: string;
  company_name: string;
  address: string;
  dian_resolution: string;
  resolution_number: string;
  invoice_prefix: string;
  cert_path: string;
  cert_password: string;
  provider: string;
};

const emptyForm: FormState = {
  nit: "",
  company_name: "",
  address: "",
  dian_resolution: "",
  resolution_number: "",
  invoice_prefix: "FV",
  cert_path: "./certs/cert.p12",
  cert_password: "",
  provider: "siigo",
};

export function AdminDianConfig() {
  const { data, isLoading } = useCompanyConfig();
  const saveMutation = useUpsertCompanyConfig();
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (data) {
      setForm({
        nit: data.nit ?? "",
        company_name: data.company_name ?? "",
        address: data.address ?? "",
        dian_resolution: data.dian_resolution ?? "",
        resolution_number: data.resolution_number ?? "",
        invoice_prefix: data.invoice_prefix ?? "FV",
        cert_path: data.cert_path ?? "./certs/cert.p12",
        cert_password: data.cert_password ?? "",
        provider: data.provider ?? "siigo",
      });
    }
  }, [data]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form, {
      onSuccess: () => {
        alert("Configuracion DIAN guardada correctamente.");
      },
      onError: (err) => {
        alert(`Error guardando configuracion: ${String(err)}`);
      },
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configuracion DIAN / Siigo</h1>
          <p className="text-muted-foreground">Administra datos fiscales y conexion con proveedor.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de Facturacion Electronica</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando configuracion...</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2">NIT</label>
                  <Input value={form.nit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, nit: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Razon social</label>
                  <Input value={form.company_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, company_name: e.target.value })} required />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-2">Direccion</label>
                  <Input value={form.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, address: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Resolucion DIAN</label>
                  <Input value={form.dian_resolution} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, dian_resolution: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Numero resolucion</label>
                  <Input value={form.resolution_number} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, resolution_number: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-2">Prefijo factura</label>
                  <Input value={form.invoice_prefix} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, invoice_prefix: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Proveedor</label>
                  <Input value={form.provider} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, provider: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Ruta certificado</label>
                  <Input value={form.cert_path} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cert_path: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-2">Password certificado</label>
                  <Input type="password" value={form.cert_password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cert_password: e.target.value })} />
                </div>
              </div>

              <Button type="submit" disabled={saveMutation.isPending} className="mt-2">
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "Guardando..." : "Guardar configuracion"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
