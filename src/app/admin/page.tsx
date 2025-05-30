"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import MenuForm from "@/components/MenuForm";
import { Addon } from "@/components/AddonDialog";

/* ---------- 型別 ---------- */
type OrderItem = {
  name: string;
  price: number;
  addons: Addon[];
  subTotal: number;
};
type Order = {
  id: string;
  items: OrderItem[];
  totalAmount?: number;
  tableNo: string;
  status: string;
  createdAt: any;
};
type Menu = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  status: string;
  addons?: Addon[];
};

const ORDER_STATUS = [
  { value: "pending", label: "待確認" },
  { value: "preparing", label: "製作中" },
  { value: "served", label: "已出餐" },
  { value: "paid", label: "已付款" },
] as const;

/* ---------- 元件 ---------- */
export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "menus" | "sales">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  /* 日期範圍預設本月 */
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(
    firstDay.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [rangeKey, setRangeKey] = useState(0); // 重新統計用

  /* ---------- 登入守門 ---------- */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  /* ---------- 監聽 orders ---------- */
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          const items: OrderItem[] = (data.items || []).map((it: any) =>
            typeof it === "string"
              ? { name: it, price: 0, addons: [], subTotal: 0 }
              : it
          );
          return { id: d.id, ...data, items };
        }) as Order[];
        setOrders(list);
      }
    );
    return () => unsub();
  }, []);

  /* ---------- 監聽 menus ---------- */
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "menus"), orderBy("name")),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Menu, "id">),
        })) as Menu[];
        setMenus(list);
      }
    );
    return () => unsub();
  }, []);

  /* ---------- 共用工具 ---------- */
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };
  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "orders", id), { status });
    showToast("狀態已更新");
  };
  const deleteMenu = async (id: string) => {
    if (!confirm("確定刪除此菜單？")) return;
    await deleteDoc(doc(db, "menus", id));
    showToast("已刪除菜單");
  };

  /* ---------- 銷售資料計算 ---------- */
  const startMs = new Date(startDate).setHours(0, 0, 0, 0);
  const endMs = new Date(endDate).setHours(23, 59, 59, 999);
  const salesOrders = orders.filter(
    (o) =>
      o.status === "paid" &&
      o.createdAt &&
      o.createdAt.seconds * 1000 >= startMs &&
      o.createdAt.seconds * 1000 <= endMs
  );
  const salesTotal = salesOrders.reduce(
    (sum, o) => sum + (o.totalAmount || 0),
    0
  );
  const avgTicket =
    salesOrders.length > 0
      ? (salesTotal / salesOrders.length).toFixed(2)
      : "0.00";

  type RankRow = { name: string; qty: number; revenue: number };
  const rankMap = new Map<string, RankRow>();
  salesOrders.forEach((o) =>
    o.items.forEach((it) => {
      const row = rankMap.get(it.name) || {
        name: it.name,
        qty: 0,
        revenue: 0,
      };
      row.qty += 1;
      row.revenue += it.subTotal || it.price || 0;
      rankMap.set(it.name, row);
    })
  );
  const ranking = Array.from(rankMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  /* ---------- 匯出 CSV ---------- */
  const exportCSV = () => {
    const header = "id,datetime,tableNo,totalAmount,items\r\n";
    const rows = salesOrders.map((o) => {
      const dt = o.createdAt
        ? new Date(o.createdAt.seconds * 1000).toISOString()
        : "";
      const itemsText = o.items
        .map((it) => {
          const add = it.addons?.length
            ? `(+${it.addons.map((a) => a.name).join("+")})`
            : "";
          return `${it.name}${add}`;
        })
        .join("|");
      return `"${o.id}","${dt}","${o.tableNo}",${o.totalAmount ?? 0},"${itemsText}"`;
    });
    const csv = header + rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_${startDate}_${endDate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ---------- 版面 ---------- */
  return (
    <main className="p-4 max-w-4xl mx-auto">
      {/* 頁首 */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">員工面板</h1>
        <button
          onClick={() => signOut(auth).then(() => router.push("/login"))}
          className="border px-3 py-1 rounded hover:bg-gray-100"
        >
          登出
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-4">
        {[
          { key: "orders", label: "即時看板" },
          { key: "menus", label: "菜單管理" },
          { key: "sales", label: "銷售記錄" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded ${
              tab === t.key ? "bg-teal-600 text-white" : "bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== 即時看板 ========== */}
      {tab === "orders" && (
        <section className="space-y-4">
          {orders
            .filter((o) => o.status !== "paid")
            .map((o) => (
              <div
                key={o.id}
                className="border rounded-lg p-4 shadow-sm flex flex-col gap-2"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    桌號：{o.tableNo}（{o.id.slice(0, 6)}…）
                  </span>
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    {ORDER_STATUS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <ul className="list-disc list-inside">
                  {o.items.map((it, idx) => (
                    <li key={idx}>
                      {it.name}
                      {it.price ? ` - $${it.price}` : ""}
                      {it.addons.map((a) => (
                        <span
                          key={a.name}
                          className="text-sm text-gray-600 ml-1"
                        >
                          (+{a.name} ${a.price})
                        </span>
                      ))}
                      {it.subTotal ? (
                        <span className="ml-1 font-semibold">
                          小計 ${it.subTotal}
                        </span>
                      ) : (
                        ""
                      )}
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between text-sm font-semibold">
                  <span>總計</span>
                  <span>
                    {typeof o.totalAmount === "number"
                      ? `$${o.totalAmount}`
                      : "—"}
                  </span>
                </div>

                <span className="text-sm text-gray-500">
                  {o.createdAt
                    ? new Date(o.createdAt.seconds * 1000).toLocaleString()
                    : "—"}
                </span>
              </div>
            ))}
          {orders.filter((o) => o.status !== "paid").length === 0 && (
            <p>目前沒有待處理訂單。</p>
          )}
        </section>
      )}

      {/* ========== 菜單管理 ========== */}
      {tab === "menus" && (
        <section>
          <button
            onClick={() => setEditing({} as Menu)}
            className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 mb-4"
          >
            ＋ 新增菜單
          </button>

          {menus.map((m) => (
            <div key={m.id} className="border rounded-lg p-3 mb-3 flex gap-3">
              <img
                src={m.imageUrl}
                alt={m.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-teal-600">${m.price}</p>
                {m.addons?.length > 0 && (
                  <p className="text-xs text-gray-500">
                    加點：{m.addons.map((a) => a.name).join("、")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span
                  className={`text-xs ${
                    m.status === "active" || m.status === "promo"
                      ? "text-green-600"
                      : m.status === "soldout"
                      ? "text-red-600"
                      : "text-gray-400"
                  }`}
                >
                  {m.status}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(m)}>✏️</button>
                  <button onClick={() => deleteMenu(m.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
          {menus.length === 0 && <p>尚無菜單。</p>}
        </section>
      )}

      {/* ========== 銷售記錄 ========== */}
      {tab === "sales" && (
        <section className="space-y-6">
          {/* 日期 + 匯出 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-1 rounded"
            />
            <span>至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-1 rounded"
            />
            <button
              onClick={() => {
                setRangeKey((k) => k + 1);
                setExpanded(null);
              }}
              className="px-3 py-1 bg-teal-600 text-white rounded"
            >
              查詢
            </button>
            <button
              onClick={exportCSV}
              className="px-3 py-1 border rounded hover:bg-gray-100 ml-auto"
              disabled={salesOrders.length === 0}
            >
              匯出 CSV
            </button>
          </div>

          {/* 統計 + 排行 */}
          <div>
            <div className="flex gap-6 font-semibold mb-2">
              <span>筆數：{salesOrders.length}</span>
              <span>營收：${salesTotal}</span>
              <span>平均客單：${avgTicket}</span>
            </div>

            <table className="w-full text-sm border-t">
              <thead>
                <tr className="text-left">
                  <th className="py-1">#</th>
                  <th className="py-1">品項</th>
                  <th className="py-1 text-right">銷量</th>
                  <th className="py-1 text-right">營收</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.name} className="border-t">
                    <td className="py-1 pr-2">{i + 1}</td>
                    <td className="py-1">{r.name}</td>
                    <td className="py-1 text-right">{r.qty}</td>
                    <td className="py-1 text-right">${r.revenue}</td>
                  </tr>
                ))}
                {ranking.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-center text-gray-500">
                      此區間尚無銷售。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 訂單列表 */}
          {salesOrders.map((o) => (
            <div
              key={o.id}
              className="border rounded-lg p-4 shadow-sm cursor-pointer"
              onClick={() =>
                setExpanded((prev) => (prev === o.id ? null : o.id))
              }
            >
              <div className="flex justify-between font-semibold">
                <span>
                  {o.createdAt
                    ? new Date(o.createdAt.seconds * 1000).toLocaleString()
                    : "—"}
                </span>
                <span>桌號：{o.tableNo}</span>
                <span>${o.totalAmount ?? "—"}</span>
              </div>

              {expanded === o.id && (
                <ul className="mt-2 list-disc list-inside text-sm">
                  {o.items.map((it, idx) => (
                    <li key={idx}>
                      {it.name} {it.price ? `- $${it.price}` : ""}
                      {it.addons.map((a) => (
                        <span
                          key={a.name}
                          className="text-gray-600 ml-1 whitespace-nowrap"
                        >
                          (+{a.name} ${a.price})
                        </span>
                      ))}
                      {it.subTotal ? (
                        <span className="ml-1 font-semibold">
                          小計 ${it.subTotal}
                        </span>
                      ) : (
                        ""
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {salesOrders.length === 0 && (
            <p>此區間尚無已付款訂單。</p>
          )}
        </section>
      )}

      {/* Dialog & Toast */}
      {editing && (
        <MenuForm
          onClose={() => setEditing(null)}
          menu={Object.keys(editing).length ? editing : null}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded">
          {toast} ✅
        </div>
      )}
    </main>
  );
}
