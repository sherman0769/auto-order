"use client";

import { useState, ChangeEvent } from "react";
import {
  getStorage,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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

/* ---------- 工具：長邊 ≤1600、裁成 16:9 ---------- */
async function compressTo16x9(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  /* 先把長邊縮到 1600 */
  const max = 1600;
  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide > max ? max / longSide : 1;
  const srcW = Math.round(bitmap.width * scale);
  const srcH = Math.round(bitmap.height * scale);

  /* 16:9 中央裁切 */
  const cropW = srcW;
  const cropH = Math.round((srcW * 9) / 16);
  const offY = Math.max(0, (srcH - cropH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, offY, cropW, cropH, 0, 0, cropW, cropH);

  return await new Promise((res) =>
    canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.8)
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
  const [progress, setProgress] = useState(0);

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
  const addAddonRow = () => setAddons((p) => [...p, { name: "", price: 0 }]);
  const updateAddon = (i: number, k: keyof Addon, v: string) =>
    setAddons((p) =>
      p.map((a, idx) =>
        idx === i ? { ...a, [k]: k === "price" ? Number(v) : v } : a
      )
    );
  const removeAddon = (i: number) => setAddons((p) => p.filter((_, idx) => idx !== i));

  /* 送出 */
  const handleSubmit = async () => {
    if (!name || !price || (menu ? false : !file)) {
      alert("請填寫完整資料");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      let imageUrl = menu?.imageUrl || "";

      /* -------- 上傳圖片 -------- */
      if (file) {
        const blob = await compressTo16x9(file);
        const storage = getStorage();          // ⭐ 在 client 端動態取得
        const filename = `dishImages/${uuid()}.jpg`;
        const imgRef = ref(storage, filename);

        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(imgRef, blob);
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(
                (snap.bytesTransferred / snap.totalBytes) * 100
              );
              setProgress(pct);
            },
            reject,
            async () => {
              imageUrl = await getDownloadURL(imgRef);
              resolve();
            }
          );
        });
      }

      /* -------- 寫入 Firestore -------- */
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
      alert("操作失敗，請重試");
    } finally {
      setLoading(false);
      setProgress(0);
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
          {loading ? `處理中… ${progress}%` : menu ? "更新" : "新增"}
        </button>
      </div>
    </div>
  );
}
