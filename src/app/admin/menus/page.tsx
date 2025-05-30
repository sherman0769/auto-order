"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import MenuForm from "@/components/MenuForm";

type Menu = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  status: string; // active / disabled
};

export default function AdminMenus() {
  const router = useRouter();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [editing, setEditing] = useState<Menu | null>(null); // null = create

  /** 未登入跳 /login */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  /** 即時監聽 menus */
  useEffect(() => {
    const q = query(collection(db, "menus"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Menu[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Menu, "id">),
      }));
      setMenus(list);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除此菜單？")) return;
    await deleteDoc(doc(db, "menus", id));
  };

  return (
    <main className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">菜單管理</h1>
        <button
          onClick={() => signOut(auth).then(() => router.push("/login"))}
          className="border px-3 py-1 rounded hover:bg-gray-100"
        >
          登出
        </button>
      </div>

      <button
        onClick={() => setEditing({} as Menu)} // 空物件＝新增模式
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
          </div>
          <div className="flex flex-col gap-1 items-end">
            <span
              className={`text-xs ${
                m.status === "active" ? "text-green-600" : "text-gray-400"
              }`}
            >
              {m.status}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setEditing(m)}>✏️</button>
              <button onClick={() => handleDelete(m.id)}>🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {/* 新增 / 編輯 Dialog */}
      {editing && (
        <MenuForm
          onClose={() => setEditing(null)}
          menu={Object.keys(editing).length ? editing : null}
        />
      )}
    </main>
  );
}
