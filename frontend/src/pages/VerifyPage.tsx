import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      const username = searchParams.get('username');
      const code = searchParams.get('code');

      if (!username || !code) {
        setStatus('error');
        return;
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, code }),
        });

        if (res.ok) {
          setStatus('success');
          setTimeout(() => navigate('/login'), 3000); // 3秒後にログイン画面へ
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md text-center">
        {status === 'loading' && <p className="text-blue-600 animate-pulse">認証中...</p>}
        {status === 'success' && (
          <div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">認証が完了しました！</h1>
            <p className="text-gray-600">自動的にログイン画面へ移動します。</p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">認証に失敗しました</h1>
            <p className="text-gray-600">リンクが無効か、有効期限が切れています。</p>
          </div>
        )}
      </div>
    </div>
  );
}