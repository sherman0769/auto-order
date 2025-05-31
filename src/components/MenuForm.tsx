"use client";

import { useState, ChangeEvent } from "react";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { v4 as uuid } from "uuid";

/* ---------- 型別 ---------- */
type Addon = { name: string; price: number };
type Menu = {
  id?: string;
  name: string;
  price: number;
  imageUrl: string;
  status: string;
  addons?: Addon[];
};
type Props = {
  onClose: () => void;
  menu: Menu | null; // null = 新增
};

/* ---------- 工具：壓縮成 16:9、最大寬 1280 ---------- */
async function compressTo16x9(file: File): Promise<Blob> {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  await new Promise((res) => (img.onload = res));

  const { width: w, height: h } = img;
  // 取中心裁成 16:9
  let cropW = w,
    cropH = (w * 9) / 16;
  if (cropH > h) {
    cropH = h;
    cropW = (h * 16) / 9;
  }
  const sx = (w - cropW) / 2;
  const sy = (h - cropH) / 2;

  // 輸出寬 1280，如原始較小則用原始
  const outW = Math.min(1280, cropW);
  const outH = (outW * 9) / 16;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);

  return await new Promise((res) =>
    canvas.toBlob(
      (b) => res(b as Blob),
      "image/jpeg",
      0.8 // 品質 80%
    )
  );
}

/* ---------- 元件 ---------- */
export default function MenuForm({ onClose, menu }: Props) {
  const [name, setName] = useState(menu?.name || "");
  const [price, setPrice] = useState<number | "">(menu?.price ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(menu?.imageUrl || null);
  const [status, setStatus] = useState(menu?.status || "active");
  const [addons, setAddons] = useState<Addon[]>(menu?.addons || []);
  const [loading, setLoading] = useState(false);

  /* 圖片預覽 */
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(menu?.imageUrl || null);
    }
  };

  /* 加點 CRUD */
  const addAddonRow = () =>
    setAddons((prev) => [...prev, { name: "", price: 0 }]);
  const updateAddon = (i: number, k: keyof Addon, v: string) =>
    setAddons((p) =>
      p.map((a, idx) =>
        idx === i ? { ...a, [k]: k === "price" ? Number(v) : v } : a
      )
    );
  const removeAddon = (i: number) =>
    setAddons((p) => p.filter((_, idx) => idx !== i));

  /* 送出 */
  const handleSubmit = async () => {
    console.log("submit clicked");

    if (!storage) {
    alert("雲端 Storage 尚未就緒，請重新整理後再試！");
    return;
     }

    if (!name || !price || (menu ? false : !file)) {
      return alert("請填寫完整資料");
    }
    
    setLoading(true);
    try {
      let imageUrl = menu?.imageUrl || "";
      if (file) {
        const blob = await compressTo16x9(file);
        const filename = `dishImages/${uuid()}.jpg`;
        const imgRef = ref(storage, filename);
        await uploadBytes(imgRef, blob);
        imageUrl = await getDownloadURL(imgRef);
      }

      const payload = {
        name,
        price: Number(price),
        imageUrl,
        status,
        addons: addons.filter((a) => a.name),
        updatedAt: serverTimestamp(),
      };

      if (menu) {
        await updateDoc(doc(db, "menus", menu.id!), payload);
        alert("已更新菜單！");
      } else {
        await addDoc(collection(db, "menus"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        alert("已新增菜單！");
      }
      onClose();
    } catch (e) {
      console.error(e);
      alert("操作失敗");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    <div
      className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-80 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          {menu ? "編輯菜單" : "新增菜單"}
        </h2>

        <input
          type="text"
          placeholder="名稱"
          className="border w-full p-2 rounded mb-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="價格"
          className="border w-full p-2 rounded mb-3"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border w-full p-2 rounded mb-3"
        >
          <option value="active">前台顯示</option>
          <option value="hidden">前台隱藏</option>
          <option value="promo">促銷</option>
          <option value="soldout">售完</option>
        </select>

        {/* 圖片 */}
        <label className="block mb-3">
          <span className="inline-block mb-1">餐點照片</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="block w-full text-sm"
          />
        </label>
        {preview && (
          <img
            src={preview}
            alt="預覽"
            className="w-full aspect-[16/9] object-cover rounded mb-3"
          />
        )}

        {/* 加點 */}
        <h3 className="font-semibold mb-2">加點項目</h3>
        {addons.map((a, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="名稱"
              className="border flex-1 p-1 rounded"
              value={a.name}
              onChange={(e) => updateAddon(i, "name", e.target.value)}
            />
            <input
              type="number"
              placeholder="加價"
              className="border w-20 p-1 rounded"
              value={a.price}
              onChange={(e) => updateAddon(i, "price", e.target.value)}
            />
            <button onClick={() => removeAddon(i)} className="text-red-600">
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={addAddonRow}
          className="mb-4 text-sm text-teal-600 hover:underline"
        >
          ＋ 新增加點
        </button>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700 disabled:bg-gray-400"
        >
          {loading ? "處理中…" : menu ? "更新" : "新增"}
        </button>
      </div>
    </div>
  );
}
