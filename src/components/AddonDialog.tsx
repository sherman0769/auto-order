"use client";

import { useState } from "react";

export type Addon = { name: string; price: number };

type Props = {
  addons: Addon[];
  onConfirm: (selected: Addon[]) => void;
  onCancel: () => void;
};

export default function AddonDialog({ addons, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Addon[]>([]);

  const toggle = (a: Addon) => {
    setSelected((prev) =>
      prev.find((x) => x.name === a.name)
        ? prev.filter((x) => x.name !== a.name)
        : [...prev, a]
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg p-6 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">選擇加點</h2>

        <ul className="space-y-2 mb-4">
          {addons.map((a) => (
            <li
              key={a.name}
              className="flex justify-between items-center border p-2 rounded"
            >
              <label className="flex-1">
                <input
                  type="checkbox"
                  checked={!!selected.find((x) => x.name === a.name)}
                  onChange={() => toggle(a)}
                  className="mr-2"
                />
                {a.name}
              </label>
              <span className="text-teal-600">+${a.price}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => onConfirm(selected)}
          className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700"
        >
          確定
        </button>
      </div>
    </div>
  );
}
