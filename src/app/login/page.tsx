"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("staff@example.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (e) {
      setError("登入失敗，請檢查帳號或密碼");
    }
  };

  return (
    <main className="h-screen flex items-center justify-center">
      <div className="border rounded-lg p-6 w-80 space-y-4 shadow">
        <h1 className="text-xl font-bold text-center">員工登入</h1>

        <input
          type="email"
          className="border w-full p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="員工信箱"
        />
        <input
          type="password"
          className="border w-full p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密碼"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={handleLogin}
          className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700"
        >
          登入
        </button>
      </div>
    </main>
  );
}
