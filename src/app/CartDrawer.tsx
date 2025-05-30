"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MenuItem } from "./page";
import { Addon } from "@/components/AddonDialog";

type CartItem = MenuItem & { addons?: Addon[] };

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  /* 讀 cart + 監聽 */
  useEffect(() => {
    const read = () => {
      const stored = localStorage.getItem("cart");
      setCart(stored ? JSON.parse(stored) : []);
    };
    read();
    window.addEventListener("cartChange", read);
    return () => window.removeEventListener("cartChange", read);
  }, []);

  const save = (next: CartItem[]) => {
    localStorage.setItem("cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cartChange"));
  };

  /* 刪除 */
  const removeItem = (idx: number) => save(cart.filter((_, i) => i !== idx));

  /* 計算總價 */
  const calcItemTotal = (item: CartItem) =>
    item.price +
    (item.addons ? item.addons.reduce((s, a) => s + a.price, 0) : 0);

  const total = cart.reduce((sum, item) => sum + calcItemTotal(item), 0);

  /* 結帳 */
  const checkout = async () => {
    const tableNo =
      localStorage.getItem("tableNo") ||
      prompt("請輸入桌號")?.trim() ||
      "UNKNOWN";

    const orderItems = cart.map((c) => ({
      name: c.name,
      price: c.price,
      addons: c.addons || [],
      subTotal: calcItemTotal(c),
    }));

    await addDoc(collection(db, "orders"), {
      tableNo,
      items: orderItems,
      totalAmount: total,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    alert(`已送單！桌號：${tableNo}`);
    save([]);
    setOpen(false);
  };

  return (
    <>
      {/* 浮動按鈕 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 rounded-full bg-teal-600 text-white w-14 h-14 shadow-lg flex items-center justify-center text-xl hover:bg-teal-700"
      >
        🛒
        {cart.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {cart.length}
          </span>
        )}
      </button>

      {/* 抽屜 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute right-0 top-0 h-full w-80 bg-white shadow-lg p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">購物車</h2>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="border-b pb-2">
                  {/* 主餐 & 價格 */}
                  <div className="flex justify-between items-center">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-600">
                        ${calcItemTotal(item)}
                      </span>
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* 加點 */}
                  {item.addons && item.addons.length > 0 && (
                    <ul className="pl-4 text-sm text-gray-600 list-disc mt-1">
                      {item.addons.map((a) => (
                        <li key={a.name}>
                          {a.name} +${a.price}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {cart.length === 0 && <p>尚未加入任何商品。</p>}
            </div>

            {/* 總計 */}
            <div className="border-t pt-2 mt-4">
              <p className="flex justify-between font-semibold">
                <span>總計</span>
                <span>${total}</span>
              </p>
            </div>

            <button
              onClick={checkout}
              disabled={cart.length === 0}
              className="mt-4 bg-teal-600 text-white w-full py-2 rounded hover:bg-teal-700 disabled:bg-gray-400"
            >
              結帳
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
