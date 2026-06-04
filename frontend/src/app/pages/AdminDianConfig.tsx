import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useCompanyConfig, useUpsertCompanyConfig } from "../api/hooks";
import { CompanyConfigUpsert } from "../api/client";

type FormState = CompanyConfigUpsert;

const emptyForm: FormState = {
  nit: "",
  companyName: "",
  address: "",
  dianResolution: "",
  resolutionNumber: "",
  invoicePrefix: "FV",
  certPath: "./certs/cert.p12",
  certPassword: "",
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
        companyName: data.companyName ?? "",
        address: data.address ?? "",
        dianResolution: data.dianResolution ?? "",
        resolutionNumber: data.resolutionNumber ?? "",
        invoicePrefix: data.invoicePrefix ?? "FV",
        certPath: data.certPath ?? "./certs/cert.p12",
        certPassword: data.certPassword ?? "",
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
                  <Input value={form.companyName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, companyName: e.target.value })} required />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-2">Direccion</label>
                  <Input value={form.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, address: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Resolucion DIAN</label>
                  <Input value={form.dianResolution} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, dianResolution: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Numero resolucion</label>
                  <Input value={form.resolutionNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, resolutionNumber: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-2">Prefijo factura</label>
                  <Input value={form.invoicePrefix} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, invoicePrefix: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Proveedor</label>
                  <Input value={form.provider} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, provider: e.target.value })} required />
                </div>
                <div>
                  <label className="block mb-2">Ruta certificado</label>
                  <Input value={form.certPath} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, certPath: e.target.value })} />
                </div>
                <div>
                  <label className="block mb-2">Password certificado</label>
                  <Input type="password" value={form.certPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, certPassword: e.target.value })} />
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
