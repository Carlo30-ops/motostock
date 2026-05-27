import { useMemo, useState } from "react";
import { Product } from "@/lib/store";

export function useInventoryFilters(products: Product[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q);
        const matchesCategory = !categoryFilter || p.category === categoryFilter;
        const matchesBrand = !brandFilter || p.brand === brandFilter;
        return matchesSearch && matchesCategory && matchesBrand;
      }),
    [products, searchTerm, categoryFilter, brandFilter]
  );

  return {
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    brandFilter,
    setBrandFilter,
    categories,
    brands,
    filteredProducts
  };
}
