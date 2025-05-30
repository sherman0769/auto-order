"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";

export default function TablePage({ params }: any) {
  // params 可能是 Promise；用 React.use() 自動解包
  const { tableNo } = React.use(params) as { tableNo: string };

  useEffect(() => {
    if (tableNo) {
      localStorage.setItem("tableNo", tableNo);
      redirect("/"); // 回顧客菜單
    }
  }, [tableNo]);

  return <p className="p-4">載入桌號中…</p>;
}
