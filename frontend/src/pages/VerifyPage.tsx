import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      const username = searchParams.get("username");
      const code = searchParams.get("code");

      if (!username || !code) {
        setStatus("error");
        return;
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, code }),
        });

        if (res.ok) {
          setStatus("success");
          setTimeout(() => navigate("/auth/login"), 3000);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-md">
        {status === "loading" && <p className="animate-pulse text-blue-600">Verifying...</p>}

        {status === "success" && (
          <div>
            <h1 className="mb-2 text-2xl font-bold text-green-600">Verification complete</h1>
            <p className="text-gray-600">Redirecting to login in 3 seconds.</p>
          </div>
        )}

        {status === "error" && (
          <div>
            <h1 className="mb-2 text-2xl font-bold text-red-600">Verification failed</h1>
            <p className="text-gray-600">This link is invalid or expired.</p>
          </div>
        )}
      </div>
    </div>
  );
}