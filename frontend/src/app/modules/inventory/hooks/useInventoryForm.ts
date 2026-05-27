import { useState } from "react";
import { Product } from "@/lib/store";
import { useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/api/hooks";
import { toast } from "sonner";
import axios from "axios";
import { InventoryFormData } from "../types";

function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data;
    if (typeof detail === "object" && detail !== null && "detail" in detail) {
      return String((detail as { detail: unknown }).detail);
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

export function useInventoryForm(t: (key: string) => string) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<InventoryFormData>({
    name: "",
    category: "",
    brand: "",
    stock: 0,
    salePrice: 0,
    costPrice: 0,
    reorderThreshold: 10,
    code: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      brand: "",
      stock: 0,
      salePrice: 0,
      costPrice: 0,
      reorderThreshold: 10,
      code: "",
    });
    setEditingProduct(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      brand: product.brand,
      stock: product.stock,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      reorderThreshold: product.reorderThreshold,
      code: product.code,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, data: formData });
        toast.success(t("inventory.editProduct") || "Producto actualizado");
      } else {
        await createProduct.mutateAsync(formData);
        toast.success(t("inventory.addProduct") || "Producto creado");
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!editingProduct) return;
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await deleteProduct.mutateAsync(editingProduct.id);
      toast.success("Producto eliminado");
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return {
    showModal,
    setShowModal,
    editingProduct,
    formData,
    setFormData,
    openAdd,
    openEdit,
    handleSubmit,
    handleDelete,
    isPending: createProduct.isPending || updateProduct.isPending || deleteProduct.isPending
  };
}
