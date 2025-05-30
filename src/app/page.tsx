"use client";

export const dynamic = "force-dynamic";   // ← 新增

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CartDrawer from "./CartDrawer";
import AddonDialog, { Addon } from "@/components/AddonDialog";

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  status: "active" | "hidden" | "promo" | "soldout";
  addons?: Addon[];
};

export default function Home() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogItem, setDialogItem] = useState<MenuItem | null>(null);

  /* 讀菜單 */
  useEffect(() => {
    const fetchMenus = async () => {
      const snap = await getDocs(collection(db, "menus"));
      const list: MenuItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MenuItem, "id">),
      }));
      setMenus(list);
      setLoading(false);
    };
    fetchMenus();
  }, []);

  /* 寫購物車 */
  const saveCart = (next: any[]) => {
    localStorage.setItem("cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cartChange"));
  };
  const handleAdd = (item: MenuItem) => {
    if (item.addons?.length) {
      setDialogItem(item);
    } else pushCart(item, []);
  };
  const pushCart = (item: MenuItem, selected: Addon[]) => {
    const stored = localStorage.getItem("cart");
    const next = stored ? JSON.parse(stored) : [];
    next.push({ ...item, addons: selected });
    saveCart(next);
    alert(`已加入：${item.name}${selected.length ? " (含加點)" : ""}`);
  };

  if (loading) return <p className="p-4">載入菜單中…</p>;

  const visibleMenus = menus.filter((m) => m.status !== "hidden");

  return (
    <>
      <main className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {visibleMenus.map((item) => (
          <div key={item.id} className="border rounded-xl shadow p-4">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full aspect-[16/9] object-cover rounded-lg mb-2"
            />
            <h2 className="text-lg font-semibold flex items-center">
              {item.name}
              {item.status === "promo" && (
                <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">
                  促銷
                </span>
              )}
              {item.status === "soldout" && (
                <span className="ml-2 text-xs bg-gray-600 text-white px-1.5 py-0.5 rounded">
                  售完
                </span>
              )}
            </h2>
            <p className="text-teal-600">${item.price}</p>
            <button
              className="mt-2 w-full rounded bg-teal-600 text-white py-1 hover:bg-teal-700 disabled:bg-gray-400"
              onClick={() => handleAdd(item)}
              disabled={item.status === "soldout"}
            >
              {item.status === "soldout" ? "無庫存" : "加入購物車"}
            </button>
          </div>
        ))}
      </main>

      {/* 加點對話框 */}
      {dialogItem && (
        <AddonDialog
          addons={dialogItem.addons!}
          onCancel={() => setDialogItem(null)}
          onConfirm={(selected) => {
            pushCart(dialogItem, selected);
            setDialogItem(null);
          }}
        />
      )}

      <CartDrawer />
    </>
  );
}
